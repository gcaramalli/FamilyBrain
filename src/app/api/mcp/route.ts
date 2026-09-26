import { serveMcp } from "@/lib/mcp/handler";

// Claude connector with the secret in a header: "Authorization: Bearer <token>"
// (Claude Code). The Claude app uses /api/mcp/<token> instead.
async function handler(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  return (await serveMcp(request, token)) ?? new Response("Unauthorized", { status: 401 });
}

export { handler as GET, handler as POST, handler as DELETE };
