import { describe, expect, it } from "vitest";
import { calculate, CalculatorInputs, UseCaseBreakdown } from "@/lib/calculator";

function breakdown(overrides: Partial<UseCaseBreakdown>): UseCaseBreakdown {
  return {
    customerSupport: 0,
    codeGeneration: 0,
    documentProcessing: 0,
    other: 0,
    ...overrides,
  };
}

const BASE_INPUTS: CalculatorInputs = {
  provider: "anthropic",
  modelId: "claude-sonnet-4-6",
  monthlyApiCalls: 100_000,
  avgInputTokensPerCall: 1000,
  avgOutputTokensPerCall: 500,
  currentMonthlySpend: 500,
  useCaseBreakdown: breakdown({ other: 100 }),
};

describe("calculate", () => {
  it("computes cost per call correctly from real Sonnet 4.6 pricing", () => {
    // Sonnet 4.6: $3/$15 per 1M. 1000 input + 500 output tokens.
    // (1000/1e6 * 3) + (500/1e6 * 15) = 0.003 + 0.0075 = 0.0105
    const result = calculate(BASE_INPUTS);
    expect(result.currentCostPerCall).toBeCloseTo(0.0105, 6);
  });

  it("throws when use case breakdown doesn't sum to 100", () => {
    expect(() =>
      calculate({ ...BASE_INPUTS, useCaseBreakdown: breakdown({ other: 50 }) })
    ).toThrow(/sum to 100/);
  });

  it("throws on non-positive monthlyApiCalls", () => {
    expect(() => calculate({ ...BASE_INPUTS, monthlyApiCalls: 0 })).toThrow(/positive/);
  });

  it("100% customer support routes entirely to the cheap tier and saves money", () => {
    const result = calculate({ ...BASE_INPUTS, useCaseBreakdown: breakdown({ customerSupport: 100 }) });
    const supportBucket = result.buckets.find((b) => b.useCase === "customerSupport")!;
    expect(supportBucket.routedTo).toBe("cheaper/fast tier");
    expect(result.savingsPct).toBeGreaterThan(0);
  });

  it("100% code generation never routes off the current model", () => {
    const result = calculate({ ...BASE_INPUTS, useCaseBreakdown: breakdown({ codeGeneration: 100 }) });
    const codeBucket = result.buckets.find((b) => b.useCase === "codeGeneration")!;
    expect(codeBucket.routedTo).toBe("current model (unchanged)");
    // Still some savings from caching alone, but strictly less than the
    // customer-support case's tiering+caching combination.
    const supportResult = calculate({ ...BASE_INPUTS, useCaseBreakdown: breakdown({ customerSupport: 100 }) });
    expect(result.savingsPct).toBeLessThan(supportResult.savingsPct);
  });

  it("100% document processing routes to the mid tier", () => {
    const result = calculate({ ...BASE_INPUTS, useCaseBreakdown: breakdown({ documentProcessing: 100 }) });
    const docBucket = result.buckets.find((b) => b.useCase === "documentProcessing")!;
    expect(docBucket.routedTo).toBe("mid tier");
  });

  it("provider 'other' never offers tiering, only caching savings", () => {
    const result = calculate({
      ...BASE_INPUTS,
      provider: "other",
      customPricing: { inputPer1M: 3, outputPer1M: 15 },
      useCaseBreakdown: breakdown({ customerSupport: 100 }),
    });
    expect(result.routingAvailable).toBe(false);
    for (const bucket of result.buckets) {
      expect(bucket.routedTo).toBe("current model (unchanged)");
    }
    // Caching alone still saves something on the cacheable fraction.
    expect(result.savingsPct).toBeGreaterThan(0);
    expect(result.savingsPct).toBeLessThan(0.4); // caching alone shouldn't look like a full tiering win
  });

  it("throws for 'other' provider without customPricing", () => {
    expect(() => calculate({ ...BASE_INPUTS, provider: "other", customPricing: undefined })).toThrow(
      /customPricing/
    );
  });

  it("payback period is null when there are no savings", () => {
    const result = calculate({ ...BASE_INPUTS, currentMonthlySpend: 0 });
    expect(result.monthlySavings).toBe(0);
    expect(result.paybackMonths).toBeNull();
  });

  it("payback period is $5000 / monthly savings", () => {
    const result = calculate({ ...BASE_INPUTS, useCaseBreakdown: breakdown({ customerSupport: 100 }) });
    if (result.paybackMonths !== null) {
      expect(result.paybackMonths).toBeCloseTo(5000 / result.monthlySavings, 6);
    }
  });

  it("dollar savings scale linearly with the user's stated spend, for the same savings percentage", () => {
    // Doubling currentMonthlySpend (the REAL stated baseline) while
    // keeping every token/pricing input identical must double the dollar
    // savings shown -- savingsPct itself shouldn't move, since it's
    // derived purely from the theoretical token/pricing model, not from
    // currentMonthlySpend.
    const base = calculate({ ...BASE_INPUTS, useCaseBreakdown: breakdown({ customerSupport: 100 }) });
    const doubledSpend = calculate({
      ...BASE_INPUTS,
      currentMonthlySpend: BASE_INPUTS.currentMonthlySpend * 2,
      useCaseBreakdown: breakdown({ customerSupport: 100 }),
    });
    expect(doubledSpend.savingsPct).toBeCloseTo(base.savingsPct, 10);
    expect(doubledSpend.monthlySavings).toBeCloseTo(base.monthlySavings * 2, 6);
  });

  it("flags a large gap between stated spend and the theoretical calculation", () => {
    const result = calculate({ ...BASE_INPUTS, currentMonthlySpend: 5000 }); // theoretical is ~$1050
    expect(Math.abs(result.statedVsTheoreticalDeltaPct)).toBeGreaterThan(1);
  });
});
