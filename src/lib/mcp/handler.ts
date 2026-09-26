import "server-only";
import { timingSafeEqual } from "node:crypto";
import { createMcpHandler } from "mcp-handler";
import { instructions, registerTools } from "./tools";

export const mcp = createMcpHandler(registerTools, {
  serverInfo: { name: "hembrain", version: "1.0.0" },
  instructions,
});

export function tokenMatches(given: string | null | undefined) {
  const expected = process.env.MCP_TOKEN;
  if (!given || !expected || expected.length < 24) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
