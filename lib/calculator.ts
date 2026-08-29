import { Provider, findModel, tierPrice, CACHE_DISCOUNT_RATE } from "./pricing";

export interface UseCaseBreakdown {
  customerSupport: number; // percent, 0-100
  codeGeneration: number;
  documentProcessing: number;
  other: number;
}

export interface CalculatorInputs {
  provider: Provider;
  modelId: string; // ignored (customPricing used instead) when provider === "other"
  customPricing?: { inputPer1M: number; outputPer1M: number };
  monthlyApiCalls: number;
  avgInputTokensPerCall: number;
  avgOutputTokensPerCall: number;
  currentMonthlySpend: number;
  useCaseBreakdown: UseCaseBreakdown;
}

// How much of each use case's traffic is realistically cacheable -- a
// reasoned assumption, not a measured fact, and documented as such rather
// than presented with false precision. Customer support skews high
// (repeated FAQs); code generation skews low (prompts are usually
// unique to the file/context); document processing is mixed (some
// repeated templates, mostly unique documents); "other" is a conservative
// middle guess since it's unclassified traffic.
const CACHEABILITY: Record<keyof UseCaseBreakdown, number> = {
  customerSupport: 0.4,
  codeGeneration: 0.1,
  documentProcessing: 0.2,
  other: 0.15,
};

export interface BucketResult {
  useCase: keyof UseCaseBreakdown;
  pct: number;
  routedTo: "current model (unchanged)" | "cheaper/fast tier" | "mid tier";
  monthlyCostBeforeCaching: number;
  monthlyCostAfterCaching: number;
}

export interface CalculatorResult {
  currentCostPerCall: number;
  currentCostPer1kTokens: number;
  theoreticalCurrentMonthlyCost: number;
  statedVsTheoreticalDeltaPct: number; // how far currentMonthlySpend is from the theoretical calc
  buckets: BucketResult[];
  optimizedTheoreticalMonthlyCost: number;
  savingsPct: number; // fraction, e.g. 0.34 = 34% cheaper
  projectedOptimizedMonthlySpend: number; // scaled to the user's real stated spend
  monthlySavings: number;
  annualSavings: number;
  paybackMonths: number | null; // null if savings don't cover the $5K audit cost at all
  routingAvailable: boolean; // false for provider === "other" (no known tier alternatives)
}

const AUDIT_ENGAGEMENT_COST = 5000;

function currentModelPricing(inputs: CalculatorInputs): { inputPer1M: number; outputPer1M: number } {
  if (inputs.provider === "other") {
    if (!inputs.customPricing) {
      throw new Error("customPricing is required when provider is 'other'");
    }
    return inputs.customPricing;
  }
  const model = findModel(inputs.provider, inputs.modelId);
  if (!model) {
    throw new Error(`Unknown model '${inputs.modelId}' for provider '${inputs.provider}'`);
  }
  return model;
}

function costPerCall(inputTokens: number, outputTokens: number, pricing: { inputPer1M: number; outputPer1M: number }) {
  return (inputTokens / 1_000_000) * pricing.inputPer1M + (outputTokens / 1_000_000) * pricing.outputPer1M;
}

function routeForUseCase(
  useCase: keyof UseCaseBreakdown,
  provider: Provider,
  current: { inputPer1M: number; outputPer1M: number }
): { pricing: { inputPer1M: number; outputPer1M: number }; routedTo: BucketResult["routedTo"] } {
  // Per the fixed methodology: customer support -> cheap/fast tier,
  // document processing -> mid tier, code generation and unclassified
  // ("other") traffic stay on whatever model the team is already using --
  // downgrading code-gen quality is exactly the kind of "savings" that
  // creates more expensive problems later, so it's deliberately excluded.
  if (provider === "other") {
    return { pricing: current, routedTo: "current model (unchanged)" };
  }
  if (useCase === "customerSupport") {
    const cheap = tierPrice(provider, "cheap");
    return cheap
      ? { pricing: cheap, routedTo: "cheaper/fast tier" }
      : { pricing: current, routedTo: "current model (unchanged)" };
  }
  if (useCase === "documentProcessing") {
    const mid = tierPrice(provider, "mid");
    return mid ? { pricing: mid, routedTo: "mid tier" } : { pricing: current, routedTo: "current model (unchanged)" };
  }
  return { pricing: current, routedTo: "current model (unchanged)" };
}

export function calculate(inputs: CalculatorInputs): CalculatorResult {
  const useCaseTotal =
    inputs.useCaseBreakdown.customerSupport +
    inputs.useCaseBreakdown.codeGeneration +
    inputs.useCaseBreakdown.documentProcessing +
    inputs.useCaseBreakdown.other;
  if (Math.abs(useCaseTotal - 100) > 0.5) {
    throw new Error(`Use case breakdown must sum to 100 (got ${useCaseTotal})`);
  }
  if (inputs.monthlyApiCalls <= 0) {
    throw new Error("monthlyApiCalls must be positive");
  }

  const current = currentModelPricing(inputs);
  const perCallCost = costPerCall(inputs.avgInputTokensPerCall, inputs.avgOutputTokensPerCall, current);
  const totalTokensPerCall = inputs.avgInputTokensPerCall + inputs.avgOutputTokensPerCall;
  const costPer1kTokens = totalTokensPerCall > 0 ? (perCallCost / totalTokensPerCall) * 1000 : 0;
  const theoreticalCurrentMonthlyCost = perCallCost * inputs.monthlyApiCalls;

  const statedVsTheoreticalDeltaPct =
    theoreticalCurrentMonthlyCost > 0
      ? (inputs.currentMonthlySpend - theoreticalCurrentMonthlyCost) / theoreticalCurrentMonthlyCost
      : 0;

  const useCases: (keyof UseCaseBreakdown)[] = ["customerSupport", "codeGeneration", "documentProcessing", "other"];
  const buckets: BucketResult[] = useCases.map((useCase) => {
    const pct = inputs.useCaseBreakdown[useCase];
    const { pricing, routedTo } = routeForUseCase(useCase, inputs.provider, current);
    const bucketCalls = inputs.monthlyApiCalls * (pct / 100);

    const inputCostPerCall = (inputs.avgInputTokensPerCall / 1_000_000) * pricing.inputPer1M;
    const outputCostPerCall = (inputs.avgOutputTokensPerCall / 1_000_000) * pricing.outputPer1M;
    const monthlyCostBeforeCaching = bucketCalls * (inputCostPerCall + outputCostPerCall);

    // Caching only discounts the input (prompt) side -- the model still
    // has to generate fresh output tokens every time regardless of
    // whether the prompt was cached.
    const cacheableFraction = CACHEABILITY[useCase];
    const monthlyInputCostAfterCaching = bucketCalls * inputCostPerCall * (1 - cacheableFraction * CACHE_DISCOUNT_RATE);
    const monthlyOutputCost = bucketCalls * outputCostPerCall;
    const monthlyCostAfterCaching = monthlyInputCostAfterCaching + monthlyOutputCost;

    return { useCase, pct, routedTo, monthlyCostBeforeCaching, monthlyCostAfterCaching };
  });

  const optimizedTheoreticalMonthlyCost = buckets.reduce((sum, b) => sum + b.monthlyCostAfterCaching, 0);

  // Savings percentage comes from the theoretical (calls x tokens x price)
  // model, since that's the only place tiering/caching can actually be
  // isolated -- but the DOLLAR figure shown is scaled against the user's
  // real stated spend, not the theoretical baseline, since their actual
  // bill reflects real-world factors (rate limits, retries, discounts)
  // a pure calculation can't see. Showing a dollar savings number derived
  // from a mismatched theoretical baseline would be less honest than one
  // grounded in what they actually told us they're paying today.
  const savingsPct =
    theoreticalCurrentMonthlyCost > 0 ? 1 - optimizedTheoreticalMonthlyCost / theoreticalCurrentMonthlyCost : 0;
  const projectedOptimizedMonthlySpend = inputs.currentMonthlySpend * (1 - savingsPct);
  const monthlySavings = inputs.currentMonthlySpend - projectedOptimizedMonthlySpend;
  const annualSavings = monthlySavings * 12;

  const paybackMonths = monthlySavings > 0 ? AUDIT_ENGAGEMENT_COST / monthlySavings : null;

  return {
    currentCostPerCall: perCallCost,
    currentCostPer1kTokens: costPer1kTokens,
    theoreticalCurrentMonthlyCost,
    statedVsTheoreticalDeltaPct,
    buckets,
    optimizedTheoreticalMonthlyCost,
    savingsPct,
    projectedOptimizedMonthlySpend,
    monthlySavings,
    annualSavings,
    paybackMonths,
    routingAvailable: inputs.provider !== "other",
  };
}
