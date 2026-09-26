import { timingSafeEqual } from "node:crypto";
import { createMcpHandler } from "mcp-handler";
import { instructions, registerTools } from "@/lib/mcp/tools";

// Claude connector for the family. The secret lives in the URL
// (/api/mcp/<MCP_TOKEN>) because the Claude app's custom connectors take a
// URL, not a custom header. Treat that URL like a password.

const mcp = createMcpHandler(registerTools, {
  serverInfo: { name: "family-brain", version: "1.0.0" },
  instructions,
});

function tokenMatches(given: string) {
  const expected = process.env.MCP_TOKEN;
  if (!expected || expected.length < 24) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handler(request: Request, { params }: RouteContext<"/api/mcp/[token]">) {
  const { token } = await params;
  if (!tokenMatches(token)) return new Response("Not found", { status: 404 });
  return mcp(request);
}

export { handler as GET, handler as POST, handler as DELETE };
