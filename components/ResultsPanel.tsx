"use client";

import { useState } from "react";
import { CalculatorResult } from "@/lib/calculator";
import { CalculatorInputs } from "@/lib/calculator";

function money(n: number, decimals = 0): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: decimals });
}

const USE_CASE_LABELS: Record<string, string> = {
  customerSupport: "Customer support",
  codeGeneration: "Code generation",
  documentProcessing: "Document processing",
  other: "Other / unclassified",
};

export function ResultsPanel({ result, inputs }: { result: CalculatorResult; inputs: CalculatorInputs }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMessage("");
    try {
      const res = await fetch("/api/send-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, inputs }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "Something went wrong sending your report.");
      }
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setErrorMessage((err as Error).message);
    }
  }

  const deltaWarning =
    Math.abs(result.statedVsTheoreticalDeltaPct) > 0.25 && inputs.currentMonthlySpend > 0
      ? `Heads up: your stated spend is ${result.statedVsTheoreticalDeltaPct > 0 ? "higher" : "lower"} than what these inputs alone calculate to (${money(result.theoreticalCurrentMonthlyCost)}/mo) -- real bills include factors this model can't see. Savings below are scaled against your actual stated spend.`
      : null;

  return (
    <div className="flex flex-col gap-8">
      <div className="rounded-xl border border-primary/30 bg-primary/10 p-8 text-center">
        <p className="text-sm text-foreground/70 mb-2">Your team would save</p>
        <p className="font-heading text-5xl font-medium mb-2">{money(result.monthlySavings)}<span className="text-xl text-foreground/50">/month</span></p>
        <p className="text-foreground/70">
          -- that&apos;s <span className="text-green font-medium">{money(result.annualSavings)}/year</span> ({(result.savingsPct * 100).toFixed(0)}% reduction)
        </p>
      </div>

      {deltaWarning && (
        <p className="text-xs text-amber bg-amber/10 border border-amber/30 rounded-lg p-3">{deltaWarning}</p>
      )}

      <div className="rounded-lg border border-border bg-surface p-6">
        <div className="grid grid-cols-2 gap-6 text-center mb-4">
          <div>
            <p className="text-xs text-foreground/50 font-mono uppercase mb-1">Current</p>
            <p className="font-heading text-2xl">{money(inputs.currentMonthlySpend)}<span className="text-sm text-foreground/40">/mo</span></p>
          </div>
          <div>
            <p className="text-xs text-foreground/50 font-mono uppercase mb-1">Optimized</p>
            <p className="font-heading text-2xl text-green">{money(result.projectedOptimizedMonthlySpend)}<span className="text-sm text-foreground/40">/mo</span></p>
          </div>
        </div>
        <p className="text-xs text-foreground/50 text-center">
          Cost per call: {money(result.currentCostPerCall, 4)} &middot; Cost per 1K tokens: {money(result.currentCostPer1kTokens, 4)}
        </p>
      </div>

      <div>
        <h3 className="font-heading text-lg font-medium mb-4">Savings breakdown by use case</h3>
        <div className="flex flex-col gap-2">
          {result.buckets
            .filter((b) => b.pct > 0)
            .map((b) => (
              <div key={b.useCase} className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 text-sm">
                <div>
                  <span className="font-medium">{USE_CASE_LABELS[b.useCase]}</span>
                  <span className="text-foreground/50"> ({b.pct}%) &rarr; {b.routedTo}</span>
                </div>
                <div className="font-mono text-xs text-foreground/70">
                  {money(b.monthlyCostBeforeCaching)} &rarr; <span className="text-green">{money(b.monthlyCostAfterCaching)}</span>
                </div>
              </div>
            ))}
        </div>
        {!result.routingAvailable && (
          <p className="text-xs text-foreground/50 mt-3">
            No model-tiering recommendation is available for a custom/&quot;Other&quot; provider -- only prompt-caching
            savings are modeled above.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-border bg-surface p-6 text-center">
        <p className="text-sm text-foreground/70">
          Payback period on a $5,000 infrastructure audit engagement:{" "}
          <span className="font-medium text-foreground">
            {result.paybackMonths === null
              ? "not applicable at these inputs"
              : result.paybackMonths < 1
                ? "under 1 month"
                : `${result.paybackMonths.toFixed(1)} months`}
          </span>
        </p>
      </div>

      <div className="rounded-xl border border-primary/30 bg-primary/10 p-8 text-center">
        <h3 className="font-heading text-xl font-medium mb-2">Want this actually implemented?</h3>
        <p className="text-sm text-foreground/70 mb-6">
          Get a free infrastructure audit to implement this -- we&apos;ll confirm these numbers against your real
          traffic and set up the routing.
        </p>
        <a
          href={process.env.NEXT_PUBLIC_CALENDLY_URL || "[CALENDLY_URL]"}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-lg bg-primary px-6 py-3 text-sm font-medium text-background hover:bg-primary-strong transition-colors"
        >
          Get a free infrastructure audit
        </a>
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="font-heading text-lg font-medium">Get the detailed breakdown by email</h3>
        {status === "sent" ? (
          <p className="text-sm text-green font-mono">Sent -- check your inbox.</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="flex-1 rounded-lg border border-border bg-background px-4 py-3 text-sm placeholder:text-foreground/40 focus:border-primary focus:outline-none"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="rounded-lg bg-primary px-5 py-3 text-sm font-medium text-background hover:bg-primary-strong transition-colors disabled:opacity-50"
            >
              {status === "sending" ? "Sending..." : "Email me the report"}
            </button>
          </form>
        )}
        {status === "error" && <p className="text-xs text-red">{errorMessage}</p>}
      </div>
    </div>
  );
}
