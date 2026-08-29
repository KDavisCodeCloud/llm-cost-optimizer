import { NextRequest, NextResponse } from "next/server";
import { calculate, CalculatorInputs } from "@/lib/calculator";
import { getSupabaseServerClient } from "@/lib/supabase";
import { sendReportEmail } from "@/lib/resend";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SendReportBody {
  email: string;
  inputs: CalculatorInputs;
  utmSource?: string;
}

export async function POST(request: NextRequest) {
  let body: SendReportBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.email || !EMAIL_RE.test(body.email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }
  if (!body.inputs) {
    return NextResponse.json({ error: "'inputs' is required" }, { status: 400 });
  }

  // Recomputed server-side from the raw inputs, never trusting a
  // client-sent result payload -- the email and persisted record should
  // reflect what this service actually calculated, not whatever a
  // tampered or stale client happened to send.
  let result;
  try {
    result = calculate(body.inputs);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { error: insertError } = await supabase.from("optimizer_sessions").insert({
    email: body.email,
    inputs: body.inputs,
    monthly_savings: result.monthlySavings,
    annual_savings: result.annualSavings,
    savings_pct: result.savingsPct,
    utm_source: body.utmSource ?? null,
  });
  if (insertError) {
    // No silent failure -- surfaced, but the email send below still
    // proceeds. A persistence failure shouldn't block the thing the
    // visitor actually asked for (their report).
    console.error(`Failed to persist optimizer_sessions row: ${insertError.message}`);
  }

  const calendlyUrl = process.env.NEXT_PUBLIC_CALENDLY_URL || "[CALENDLY_URL]";
  try {
    await sendReportEmail({ to: body.email, result, calendlyUrl });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }

  return NextResponse.json({ status: "sent" });
}
