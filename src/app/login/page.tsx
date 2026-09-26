"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Email + password by default. The emailed 6-digit code stays as a fallback
// (Supabase's built-in mailer only allows a few emails per hour).
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"password" | "code-email" | "code">("password");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setMode("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.verifyOtp({ email, token: code.trim(), type: "email" });
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
          <p className="text-sm text-muted">Code sent to <b>{email}</b>.</p>
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

      {error && <p className="text-sm text-danger">{error}</p>}
    </main>
  );
}
