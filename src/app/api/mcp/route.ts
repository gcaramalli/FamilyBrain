import { mcp, tokenMatches } from "@/lib/mcp/handler";

// Claude connector. Preferred setup: URL /api/mcp with the request header
// "Authorization: Bearer <MCP_TOKEN>" (stored by Claude, never shown again),
// so the URL itself holds no secret.
async function handler(request: Request) {
  const auth = request.headers.get("authorization");
  const token = auth?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!tokenMatches(token)) return new Response("Unauthorized", { status: 401 });
  return mcp(request);
}

export { handler as GET, handler as POST, handler as DELETE };
