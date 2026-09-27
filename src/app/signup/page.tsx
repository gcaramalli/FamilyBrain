"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}

// Two ways in: create a new family, or join one with an invite link
// (/signup?invite=<code>) that a family admin shared.
function SignupForm() {
  const router = useRouter();
  const invite = useSearchParams().get("invite");
  const [familyName, setFamilyName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await createClient().auth.signUp({
      email: email.trim(),
      password,
      options: {
        // The date of birth goes on the member card (see handle_new_user).
        data: {
          display_name: name.trim(),
          ...(invite ? { invite_code: invite } : { family_name: familyName.trim() }),
          ...(birthdate ? { birthdate } : {}),
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setBusy(false);
    if (error) {
      if (/database error/i.test(error.message)) {
        setError(invite ? "This invite link is invalid, expired or already used. Ask for a new one." : "Something went wrong creating your account. Try again.");
      } else if (/already registered/i.test(error.message)) {
        setError("An account with this email already exists. Sign in instead.");
      } else {
        setError(error.message);
      }
      return;
    }
    if (data.session) {
      router.replace("/");
      router.refresh();
    } else {
      // Email confirmation is on in Supabase.
      setCheckEmail(true);
    }
  }

  if (checkEmail) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-6">
        <h1 className="h1">Check your email</h1>
        <p className="text-muted">We sent a confirmation link to <b>{email}</b>. Open it, then sign in.</p>
        <Link href="/login" className="btn">Go to sign in</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <div className="text-4xl">🏡</div>
        <h1 className="h1 mt-2">{invite ? "Join your family" : "Create your family"}</h1>
        <p className="text-muted">
          {invite ? "You were invited to a family on Hembrain." : "Shared calendar, lists and recipes for your household."}
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3">
        {!invite && (
          <input className="input" required placeholder="Family name (e.g. Andersson)" value={familyName} onChange={(e) => setFamilyName(e.target.value)} />
        )}
        <input className="input" required autoComplete="given-name" placeholder="Your first name" value={name} onChange={(e) => setName(e.target.value)} />
        <label>
          <span className="label">Date of birth (for birthday reminders, optional)</span>
          <input className="input" type="date" autoComplete="bday" max={new Date().toISOString().slice(0, 10)} value={birthdate} onChange={(e) => setBirthdate(e.target.value)} />
        </label>
        <input className="input" type="email" required autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input
          className="input"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Password (at least 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="btn" disabled={busy}>{busy ? "Creating…" : invite ? "Join" : "Create family"}</button>
      </form>

      {error && <p className="text-sm text-danger">{error}</p>}

      <p className="text-center text-sm text-muted">
        Already have an account? <Link href="/login" className="text-accent">Sign in</Link>
      </p>
    </main>
  );
}
