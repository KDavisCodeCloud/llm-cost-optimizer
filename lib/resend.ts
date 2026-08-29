import { Resend } from "resend";
import { CalculatorResult } from "./calculator";
import { buildReportEmailHtml } from "./report-email";

export async function sendReportEmail({
  to,
  result,
  calendlyUrl,
}: {
  to: string;
  result: CalculatorResult;
  calendlyUrl: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  const fromAddress = process.env.RESEND_FROM_ADDRESS || "optimizer@thdstack.com";
  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: fromAddress,
    to,
    subject: `Your LLM Cost Optimizer results -- ${Math.round(result.savingsPct * 100)}% potential savings`,
    html: buildReportEmailHtml(result, calendlyUrl),
  });

  if (error) {
    throw new Error(`Resend send failed: ${error.message}`);
  }
}
