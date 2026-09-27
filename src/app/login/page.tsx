"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Email + password by default. Forgot it: a 6-digit code (or the link) by
// email signs you in, then you choose a new password.
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"password" | "code-email" | "code" | "new-password">("password");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Back from an email link that no longer works (/auth/callback).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("link") === "expired")
      setError("That email link has expired or was opened in another browser. Ask for a new code below.");
  }, []);

  function done() {
    router.replace("/");
    router.refresh();
  }

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError(error.message === "Invalid login credentials" ? "Wrong email or password." : error.message);
    else done();
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth/callback?next=/profile` },
    });
    setBusy(false);
    if (!error) return setMode("code");
    // Supabase's built-in mailer allows only a few emails per hour.
    setError(/rate limit|security purposes/i.test(error.message) ? "Too many emails sent. Wait a few minutes and try again." : error.message);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.verifyOtp({ email, token: code.trim(), type: "email" });
    setBusy(false);
    if (error) setError(/expired|invalid/i.test(error.message) ? "That code is wrong or expired. Ask for a new one." : error.message);
    else setMode("new-password");
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.updateUser({ password: newPassword });
    setBusy(false);
    if (error) setError(error.message);
    else done();
  }

  const emailField = (
    <input
      className="input"
      type="email"
      autoComplete="email"
      required
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      placeholder="Email"
    />
  );

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <div className="text-4xl">🏡</div>
        <h1 className="h1 mt-2">Hembrain</h1>
        <p className="text-muted">Calendar, lists, recipes and everything we need to remember.</p>
      </div>

      {mode === "password" && (
        <form onSubmit={signInWithPassword} className="flex flex-col gap-3">
          {emailField}
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />
          <button className="btn" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          <button type="button" className="text-sm text-muted" onClick={() => { setMode("code-email"); setError(null); }}>
            Forgot your password? Get a code by email
          </button>
        </form>
      )}

      {mode === "code-email" && (
        <form onSubmit={sendCode} className="flex flex-col gap-3">
          {emailField}
          <button className="btn" disabled={busy}>{busy ? "Sending…" : "Send me a code"}</button>
          <button type="button" className="text-sm text-muted" onClick={() => { setMode("password"); setError(null); }}>
            ← Back to password
          </button>
        </form>
      )}

      {mode === "code" && (
        <form onSubmit={verify} className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            Code sent to <b>{email}</b>. Not there after a minute? Look in spam, or tap the link in the email instead.
          </p>
          <input
            className="input text-center text-2xl tracking-[0.4em]"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
          />
          <button className="btn" disabled={busy}>{busy ? "Checking…" : "Sign in"}</button>
          <button type="button" className="text-sm text-muted" onClick={() => setMode("password")}>
            ← Back
          </button>
        </form>
      )}

      {mode === "new-password" && (
        <form onSubmit={savePassword} className="flex flex-col gap-3">
          <p className="text-sm text-muted">You&apos;re in. Choose a new password for next time.</p>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (at least 8 characters)"
          />
          <button className="btn" disabled={busy}>{busy ? "Saving…" : "Save and continue"}</button>
          <button type="button" className="text-sm text-muted" onClick={done}>
            Skip for now
          </button>
        </form>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <p className="text-center text-sm text-muted">
        New here? <Link href="/signup" className="text-accent">Create a family</Link>
        {" · "}
        <Link href="/welcome" className="text-accent">What is Hembrain?</Link>
      </p>
    </main>
  );
}
