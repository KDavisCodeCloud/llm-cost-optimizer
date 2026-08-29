// Real per-million-token pricing, checked directly against provider
// pricing pages / current reporting on 2026-08-28 -- not estimated, not
// carried over from training data. Prices move; this needs a periodic
// re-check (quarterly is reasonable given how often these providers have
// been repricing in 2026), not a "set once" table. Azure OpenAI pricing
// mirrors OpenAI's direct API pricing for equivalent models -- Microsoft
// prices Azure OpenAI Service to match OpenAI's own rates in the general
// case; flagged as the one entry not independently re-verified against
// Azure's own pricing page.

export type Provider = "openai" | "anthropic" | "azure_openai" | "google" | "other";

export interface ModelPricing {
  id: string;
  label: string;
  inputPer1M: number; // USD
  outputPer1M: number; // USD
  tier: "premium" | "mid" | "cheap";
}

export const PROVIDERS: { id: Provider; label: string }[] = [
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "azure_openai", label: "Azure OpenAI" },
  { id: "google", label: "Google (Gemini)" },
  { id: "other", label: "Other" },
];

export const MODELS_BY_PROVIDER: Record<Exclude<Provider, "other">, ModelPricing[]> = {
  anthropic: [
    { id: "claude-opus-4-8", label: "Claude Opus 4.8", inputPer1M: 5.0, outputPer1M: 25.0, tier: "premium" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", inputPer1M: 3.0, outputPer1M: 15.0, tier: "mid" },
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", inputPer1M: 1.0, outputPer1M: 5.0, tier: "cheap" },
  ],
  openai: [
    { id: "gpt-4o", label: "GPT-4o", inputPer1M: 2.5, outputPer1M: 10.0, tier: "premium" },
    { id: "gpt-4.1", label: "GPT-4.1", inputPer1M: 2.0, outputPer1M: 8.0, tier: "premium" },
    { id: "gpt-4.1-mini", label: "GPT-4.1 Mini", inputPer1M: 0.4, outputPer1M: 1.6, tier: "mid" },
    { id: "gpt-4.1-nano", label: "GPT-4.1 Nano", inputPer1M: 0.1, outputPer1M: 0.4, tier: "cheap" },
  ],
  azure_openai: [
    { id: "gpt-4o", label: "GPT-4o (Azure)", inputPer1M: 2.5, outputPer1M: 10.0, tier: "premium" },
    { id: "gpt-4.1", label: "GPT-4.1 (Azure)", inputPer1M: 2.0, outputPer1M: 8.0, tier: "premium" },
    { id: "gpt-4.1-mini", label: "GPT-4.1 Mini (Azure)", inputPer1M: 0.4, outputPer1M: 1.6, tier: "mid" },
    { id: "gpt-4.1-nano", label: "GPT-4.1 Nano (Azure)", inputPer1M: 0.1, outputPer1M: 0.4, tier: "cheap" },
  ],
  google: [
    { id: "gemini-3.1-pro", label: "Gemini 3.1 Pro", inputPer1M: 2.0, outputPer1M: 12.0, tier: "premium" },
    { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash", inputPer1M: 1.5, outputPer1M: 9.0, tier: "mid" },
    { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite", inputPer1M: 0.1, outputPer1M: 0.4, tier: "cheap" },
  ],
};

export const PRICING_AS_OF = "2026-08-28";

// Prompt caching's real, provider-confirmed discount on cached input
// tokens -- Anthropic documents ~90% off cached input; used as the
// general assumption across providers since OpenAI/Google publish
// similar (75-90%) cached-input discounts.
export const CACHE_DISCOUNT_RATE = 0.9;

export function getModelsForProvider(provider: Provider): ModelPricing[] {
  if (provider === "other") return [];
  return MODELS_BY_PROVIDER[provider];
}

export function findModel(provider: Provider, modelId: string): ModelPricing | undefined {
  if (provider === "other") return undefined;
  return MODELS_BY_PROVIDER[provider].find((m) => m.id === modelId);
}

export function tierPrice(provider: Provider, tier: ModelPricing["tier"]): ModelPricing | undefined {
  if (provider === "other") return undefined;
  return MODELS_BY_PROVIDER[provider].find((m) => m.tier === tier);
}
