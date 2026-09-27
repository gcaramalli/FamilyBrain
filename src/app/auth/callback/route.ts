import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// For when someone taps the link in the email instead of typing the code.
// `token_hash` links (see docs/auth-emails.md) work in any browser, e.g. the
// Gmail app's; `code` links (Supabase's default) only in the browser that
// asked for the email. `next` = where to land (Profile after a forgotten
// password, to set a new one).
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  // Only paths on this site ("//other.site" would leave it).
  const raw = params.get("next") ?? "/";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  const supabase = await createClient();
  const tokenHash = params.get("token_hash");
  const code = params.get("code");
  let ok = false;
  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: (params.get("type") as EmailOtpType) ?? "email" });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }
  // A dead link (expired, or opened in another browser) goes back to sign-in.
  return NextResponse.redirect(new URL(ok ? next : "/login?link=expired", request.url));
}
