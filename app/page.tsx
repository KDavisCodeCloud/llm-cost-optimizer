"use client";

import { useMemo, useState } from "react";
import { Provider, PROVIDERS, getModelsForProvider } from "@/lib/pricing";
import { calculate, CalculatorInputs, UseCaseBreakdown } from "@/lib/calculator";
import { ResultsPanel } from "@/components/ResultsPanel";

const CALLS_MIN = 1_000;
const CALLS_MAX = 10_000_000;

// Log-scale slider -- a linear 1K-10M slider would waste ~90% of its
// travel on the bottom decade. Position 0-100 maps exponentially across
// the 4 orders of magnitude this range actually spans.
function sliderPositionToCalls(pos: number): number {
  return Math.round(CALLS_MIN * Math.pow(CALLS_MAX / CALLS_MIN, pos / 100));
}
function callsToSliderPosition(calls: number): number {
  return (Math.log(calls / CALLS_MIN) / Math.log(CALLS_MAX / CALLS_MIN)) * 100;
}

function formatCalls(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return String(n);
}

export default function Page() {
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [modelId, setModelId] = useState("claude-sonnet-4-6");
  const [customInputPrice, setCustomInputPrice] = useState(3);
  const [customOutputPrice, setCustomOutputPrice] = useState(15);
  const [monthlyApiCalls, setMonthlyApiCalls] = useState(100_000);
  const [avgInputTokens, setAvgInputTokens] = useState(1000);
  const [avgOutputTokens, setAvgOutputTokens] = useState(500);
  const [currentMonthlySpend, setCurrentMonthlySpend] = useState(1000);
  const [useCase, setUseCase] = useState<UseCaseBreakdown>({
    customerSupport: 40,
    codeGeneration: 30,
    documentProcessing: 20,
    other: 10,
  });

  const models = getModelsForProvider(provider);
  const useCaseTotal = useCase.customerSupport + useCase.codeGeneration + useCase.documentProcessing + useCase.other;
  const useCaseValid = Math.abs(useCaseTotal - 100) < 0.5;

  function handleProviderChange(next: Provider) {
    setProvider(next);
    const nextModels = getModelsForProvider(next);
    if (nextModels.length > 0) setModelId(nextModels[0].id);
  }

  const inputs: CalculatorInputs = useMemo(
    () => ({
      provider,
      modelId,
      customPricing: provider === "other" ? { inputPer1M: customInputPrice, outputPer1M: customOutputPrice } : undefined,
      monthlyApiCalls,
      avgInputTokensPerCall: avgInputTokens,
      avgOutputTokensPerCall: avgOutputTokens,
      currentMonthlySpend,
      useCaseBreakdown: useCase,
    }),
    [provider, modelId, customInputPrice, customOutputPrice, monthlyApiCalls, avgInputTokens, avgOutputTokens, currentMonthlySpend, useCase]
  );

  const result = useMemo(() => {
    if (!useCaseValid) return null;
    try {
      return calculate(inputs);
    } catch {
      return null;
    }
  }, [inputs, useCaseValid]);

  function updateUseCase(key: keyof UseCaseBreakdown, value: number) {
    setUseCase((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <main className="flex-1 flex flex-col items-center px-6 py-16">
      <div className="w-full max-w-3xl">
        <header className="mb-10 text-center">
          <h1 className="font-heading text-3xl md:text-4xl font-medium mb-3">LLM Cost Optimizer</h1>
          <p className="text-foreground/60">
            See what model tiering and prompt caching would actually save your team -- real numbers, updated live as
            you adjust the inputs.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="rounded-xl border border-border bg-surface p-6">
            <label className="block text-sm font-medium mb-2">Primary LLM provider</label>
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as Provider)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>

            {provider !== "other" ? (
              <>
                <label className="block text-sm font-medium mb-2 mt-4">Current model</label>
                <select
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div>
                  <label className="block text-xs text-foreground/60 mb-1">$/1M input tokens</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={customInputPrice}
                    onChange={(e) => setCustomInputPrice(Number(e.target.value))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-foreground/60 mb-1">$/1M output tokens</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={customOutputPrice}
                    onChange={(e) => setCustomOutputPrice(Number(e.target.value))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-surface p-6">
            <label className="block text-sm font-medium mb-2">Current monthly spend (USD)</label>
            <input
              type="number"
              min={0}
              value={currentMonthlySpend}
              onChange={(e) => setCurrentMonthlySpend(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none mb-4"
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-foreground/60 mb-1">Avg input tokens/call</label>
                <input
                  type="number"
                  min={0}
                  value={avgInputTokens}
                  onChange={(e) => setAvgInputTokens(Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-foreground/60 mb-1">Avg output tokens/call</label>
                <input
                  type="number"
                  min={0}
                  value={avgOutputTokens}
                  onChange={(e) => setAvgOutputTokens(Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6 mb-8">
          <div className="flex justify-between text-sm font-medium mb-2">
            <label>Monthly API calls</label>
            <span className="font-mono text-primary">{formatCalls(monthlyApiCalls)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={callsToSliderPosition(monthlyApiCalls)}
            onChange={(e) => setMonthlyApiCalls(sliderPositionToCalls(Number(e.target.value)))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-foreground/40 font-mono mt-1">
            <span>1K</span>
            <span>10M</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6 mb-8">
          <div className="flex justify-between items-baseline mb-4">
            <h2 className="text-sm font-medium">Use case breakdown</h2>
            <span className={`text-xs font-mono ${useCaseValid ? "text-green" : "text-red"}`}>
              {useCaseTotal}% {useCaseValid ? "" : "-- must total 100%"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {(
              [
                ["customerSupport", "Customer support"],
                ["codeGeneration", "Code generation"],
                ["documentProcessing", "Document processing"],
                ["other", "Other"],
              ] as [keyof UseCaseBreakdown, string][]
            ).map(([key, label]) => (
              <div key={key}>
                <div className="flex justify-between text-xs text-foreground/60 mb-1">
                  <span>{label}</span>
                  <span className="font-mono">{useCase[key]}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={useCase[key]}
                  onChange={(e) => updateUseCase(key, Number(e.target.value))}
                  className="w-full"
                />
              </div>
            ))}
          </div>
        </div>

        {result ? (
          <ResultsPanel result={result} inputs={inputs} />
        ) : (
          <p className="text-center text-sm text-red">Use case breakdown must total 100% to see results.</p>
        )}
      </div>
    </main>
  );
}
