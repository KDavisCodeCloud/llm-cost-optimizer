# LLM Cost Optimizer

Phase 2C of the consulting delivery system. Public, no-login interactive
calculator -- live model-tiering and prompt-caching savings estimate based
on real provider pricing, with an email-capture CTA for the detailed
report and a "book a free audit" CTA to Calendly.

## Pricing data

`lib/pricing.ts` -- checked directly against provider pricing pages/current
reporting on 2026-08-28, not carried over from training data. This needs a
periodic re-check (these providers have been repricing frequently through
2026); the file's own header comment states the as-of date so staleness is
visible rather than silent. Azure OpenAI pricing is assumed to mirror
OpenAI's direct pricing for equivalent models -- the one entry not
independently re-verified against Azure's own pricing page.

## How the calculation actually works

`lib/calculator.ts` -- pure functions, fully unit tested (12 tests). The
one design decision worth understanding: the **percentage** savings figure
comes from a theoretical model (calls x tokens x price, with tiering and
caching applied), but the **dollar** figure shown is that percentage
applied to the user's own stated `currentMonthlySpend`, not the
theoretical baseline. A real bill reflects factors (retries, discounts,
rate limiting) a pure token-counting model can't see -- showing a dollar
figure grounded in what someone actually told us they're paying is more
honest than one derived from a calculation that might not match their
real bill. If the two diverge by more than 25%, the UI surfaces that
directly rather than silently picking one number.

Routing rule (per the fixed methodology): customer support traffic routes
to the cheap/fast tier, document processing to the mid tier, code
generation and unclassified ("other") traffic never get downgraded --
downgrading code-gen quality to save money is exactly the kind of
optimization that creates more expensive problems later. Caching
discounts (90% off, per Anthropic's documented cached-input rate) apply
per use case at different assumed cacheability rates (customer support
highest, code generation lowest) -- a reasoned assumption, documented as
one in the code, not measured fact.

## Report delivery: HTML email, not a PDF attachment

The spec for this tool says "detailed breakdown report sent via Resend,"
not explicitly a PDF (unlike the sibling scorecard tool, which does
require one). Given a real, multi-hour debugging saga on that sibling
repo tracing three different PDF libraries' Vercel-serverless
incompatibilities before landing on one that worked, this tool sends a
well-formatted HTML email (`lib/report-email.ts`) instead -- it satisfies
the actual requirement without importing any of that risk.

## Running locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Apply `supabase/migrations/001_optimizer_schema.sql` before testing the
email-capture flow end to end.

## Testing

```bash
npm test
```

## NOVA integration notes

None yet, same as the scorecard -- a future integration point is
surfacing new optimizer leads (`optimizer_sessions` with an email) into
NOVA's lead pipeline per Phase 8's marketing integration design.
