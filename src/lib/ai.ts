import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { FREE_MONTHLY_LIMIT_USD, monthStart } from "@/lib/ai-budget";

// In-app Claude features (receipt scan, "add in plain words") need an
// Anthropic API key on the server, and the service-role key to meter them
// against the family's budget; without both the app hides them.
export const aiEnabled = () =>
  Boolean(process.env.ANTHROPIC_API_KEY && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY));

const MODEL = "claude-opus-5";
// $ per million tokens (input, output). Cache reads cost 0.1× input, cache
// writes 1.25×. A model missing here (e.g. a new fallback) is priced as Opus.
const PRICES: Record<string, [number, number]> = {
  "claude-opus-5": [5, 25],
  "claude-opus-4-8": [5, 25],
  "claude-sonnet-5": [2, 10],
  "claude-haiku-4-5": [1, 5],
};

let client: Anthropic | null = null;

// Who pays for a call: the family's monthly budget (ai_budgets, 0020).
export type AiCaller = { familyId: string; profileId: string; feature: string };

// Thrown before calling Claude when the family's month is used up.
export class BudgetExceededError extends Error {
  constructor() {
    super("This month's AI budget is used up. It resets on the 1st.");
  }
}

async function assertBudget(familyId: string) {
  const admin = createAdminClient();
  const [{ data: budget }, { data: rows }] = await Promise.all([
    admin.from("ai_budgets").select("monthly_limit_usd").eq("family_id", familyId).maybeSingle(),
    admin.from("ai_usage").select("cost_usd").eq("family_id", familyId).gte("created_at", monthStart().toISOString()),
  ]);
  const limit = budget ? Number(budget.monthly_limit_usd) : FREE_MONTHLY_LIMIT_USD;
  const spent = (rows ?? []).reduce((sum, r) => sum + Number(r.cost_usd), 0);
  if (spent >= limit) throw new BudgetExceededError();
}

async function logUsage(caller: AiCaller, model: string, usage: Anthropic.Beta.BetaUsage) {
  const [inPrice, outPrice] = PRICES[model] ?? PRICES[MODEL];
  const input = usage.input_tokens + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
  const cost =
    (usage.input_tokens * inPrice +
      (usage.cache_creation_input_tokens ?? 0) * inPrice * 1.25 +
      (usage.cache_read_input_tokens ?? 0) * inPrice * 0.1 +
      usage.output_tokens * outPrice) /
    1_000_000;
  await createAdminClient().from("ai_usage").insert({
    family_id: caller.familyId,
    profile_id: caller.profileId,
    feature: caller.feature,
    model,
    input_tokens: input,
    output_tokens: usage.output_tokens,
    cost_usd: cost,
  });
}

// One structured-output call: returns data matching `schema`, or throws.
// Refused up front when the caller's family is over its monthly budget.
export async function extract<S extends z.ZodType>(
  caller: AiCaller,
  schema: S,
  system: string,
  content: Anthropic.Beta.BetaContentBlockParam[],
  effort: "low" | "medium" = "low",
): Promise<z.infer<S>> {
  await assertBudget(caller.familyId);
  client ??= new Anthropic();
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    // If a safety classifier declines, Anthropic retries on its recommended model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort, format: betaZodOutputFormat(schema) },
    system,
    messages: [{ role: "user", content }],
  });
  // Logging must not lose the answer the family already paid for.
  await logUsage(caller, response.model, response.usage).catch((e) => console.error("ai_usage", e));
  if (response.stop_reason === "refusal") throw new Error("Claude declined this request.");
  if (response.parsed_output == null) throw new Error("Claude's answer could not be read.");
  return response.parsed_output as z.infer<S>;
}
