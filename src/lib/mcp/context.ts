import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Who is calling the connector, resolved from their personal link.
export type McpContext = { familyId: string; familyName: string | null; speaker: string | null };

export const mcpContext = new AsyncLocalStorage<McpContext>();

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function legacyTokenMatches(given: string) {
  const expected = process.env.MCP_TOKEN;
  if (!expected || expected.length < 24) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Personal links first (connector_tokens), then the old single-family
// MCP_TOKEN + FAMILY_ID env setup.
export async function resolveToken(token: string | null | undefined): Promise<McpContext | null> {
  if (!token || token.length < 24) return null;
  const db = createAdminClient();
  const { data } = await db
    .from("connector_tokens")
    .select("id, profiles!inner(display_name, family_id, families!inner(name))")
    .eq("token_hash", sha256(token))
    .maybeSingle();
  if (data) {
    const profile = data.profiles as unknown as { display_name: string; family_id: string; families: { name: string } };
    await db.from("connector_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
    return { familyId: profile.family_id, familyName: profile.families.name, speaker: profile.display_name || null };
  }
  if (legacyTokenMatches(token) && process.env.FAMILY_ID) {
    return { familyId: process.env.FAMILY_ID, familyName: null, speaker: null };
  }
  return null;
}
