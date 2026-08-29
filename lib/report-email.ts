import { CalculatorResult } from "./calculator";

const USE_CASE_LABELS: Record<string, string> = {
  customerSupport: "Customer support",
  codeGeneration: "Code generation",
  documentProcessing: "Document processing",
  other: "Other / unclassified",
};

function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function buildReportEmailHtml(result: CalculatorResult, calendlyUrl: string): string {
  const bucketRows = result.buckets
    .filter((b) => b.pct > 0)
    .map(
      (b) => `
      <tr>
        <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">${USE_CASE_LABELS[b.useCase]} (${b.pct}%)</td>
        <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">${b.routedTo}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${money(b.monthlyCostBeforeCaching)}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${money(b.monthlyCostAfterCaching)}</td>
      </tr>`
    )
    .join("");

  const paybackLine =
    result.paybackMonths === null
      ? "Not applicable at these inputs."
      : result.paybackMonths < 1
        ? "Under 1 month."
        : `${result.paybackMonths.toFixed(1)} months.`;

  return `
  <div style="font-family:Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;color:#111;">
    <h1 style="font-size:20px;margin-bottom:4px;">LLM Cost Optimizer -- your results</h1>
    <p style="color:#666;font-size:13px;margin-top:0;">THD Agentic Systems</p>

    <div style="background:#f3f4f6;border-radius:8px;padding:20px;margin:20px 0;text-align:center;">
      <p style="font-size:14px;color:#444;margin:0 0 6px;">Your team would save</p>
      <p style="font-size:32px;font-weight:bold;margin:0;">${money(result.monthlySavings)}/month</p>
      <p style="font-size:14px;color:#444;margin:6px 0 0;">-- that's ${money(result.annualSavings)}/year (${(result.savingsPct * 100).toFixed(0)}% reduction)</p>
    </div>

    <p><strong>Payback period on a $5,000 infrastructure audit engagement:</strong> ${paybackLine}</p>

    <h2 style="font-size:16px;margin-top:28px;">Savings breakdown by use case</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px;">
      <thead>
        <tr style="text-align:left;background:#f9fafb;">
          <th style="padding:6px 12px;">Use case</th>
          <th style="padding:6px 12px;">Routing</th>
          <th style="padding:6px 12px;text-align:right;">Before</th>
          <th style="padding:6px 12px;text-align:right;">After</th>
        </tr>
      </thead>
      <tbody>${bucketRows}</tbody>
    </table>

    <div style="background:#eff6ff;border-radius:8px;padding:16px;margin-top:28px;">
      <p style="margin:0;font-size:14px;">
        Want this actually implemented, not just modeled? Book a free 30-minute Architecture Audit:
        <a href="${calendlyUrl}">${calendlyUrl}</a>
      </p>
    </div>
  </div>`;
}
