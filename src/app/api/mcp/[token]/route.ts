import { mcp, tokenMatches } from "@/lib/mcp/handler";

// Legacy setup: the secret lives in the URL (/api/mcp/<MCP_TOKEN>). Prefer
// /api/mcp with an Authorization header (see ../route.ts).
async function handler(request: Request, { params }: RouteContext<"/api/mcp/[token]">) {
  const { token } = await params;
  if (!tokenMatches(token)) return new Response("Not found", { status: 404 });
  return mcp(request);
}

export { handler as GET, handler as POST, handler as DELETE };
