import { serveMcp } from "@/lib/mcp/handler";

// Claude / ChatGPT connector: personal link created in the Profile tab
// (/api/mcp/<token>). The link itself is the secret.
async function handler(request: Request, { params }: RouteContext<"/api/mcp/[token]">) {
  const { token } = await params;
  return (await serveMcp(request, token)) ?? new Response("Not found", { status: 404 });
}

export { handler as GET, handler as POST, handler as DELETE };
