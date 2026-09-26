import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

// In-app Claude features (receipt scan, "add in plain words") need an
// Anthropic API key on the server; without one the app hides them.
export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

let client: Anthropic | null = null;

// One structured-output call: returns data matching `schema`, or throws.
export async function extract<S extends z.ZodType>(
  schema: S,
  system: string,
  content: Anthropic.Beta.BetaContentBlockParam[],
  effort: "low" | "medium" = "low",
): Promise<z.infer<S>> {
  client ??= new Anthropic();
  const response = await client.beta.messages.parse({
    model: "claude-opus-5",
    max_tokens: 16000,
    // If a safety classifier declines, Anthropic retries on its recommended model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort, format: betaZodOutputFormat(schema) },
    system,
    messages: [{ role: "user", content }],
  });
  if (response.stop_reason === "refusal") throw new Error("Claude declined this request.");
  if (response.parsed_output == null) throw new Error("Claude's answer could not be read.");
  return response.parsed_output as z.infer<S>;
}
