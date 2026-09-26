"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFamily } from "@/components/family-context";

const COLORS = ["#4f46e5", "#db2777", "#059669", "#d97706", "#0891b2", "#7c3aed", "#dc2626", "#475569"];

export default function ProfilePage() {
  const { supabase, profile, members } = useFamily();
  const router = useRouter();
  const me = members.find((m) => m.profile_id === profile.id);
  const [name, setName] = useState(profile.display_name);
  const [color, setColor] = useState(profile.color);
  const [emoji, setEmoji] = useState(me?.emoji ?? "🙂");
  const [saved, setSaved] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [pwMessage, setPwMessage] = useState<string | null>(null);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwMessage(error ? error.message : "✓ Mot de passe changé");
    if (!error) setNewPassword("");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from("profiles").update({ display_name: name, color }).eq("id", profile.id);
    // Keep the calendar "member" row in sync with the profile.
    if (me) await supabase.from("members").update({ name, color, emoji }).eq("id", me.id);
    setSaved(true);
    router.refresh();
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="h1">Profile</h1>

      <form onSubmit={save} className="card flex flex-col gap-3">
        <div>
          <span className="label">Name</span>
          <input className="input" value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} />
        </div>
        <div>
          <span className="label">Emoji</span>
          <input className="input w-20 text-center text-xl" value={emoji} onChange={(e) => { setEmoji(e.target.value); setSaved(false); }} />
        </div>
        <div>
          <span className="label">Colour on the calendar</span>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => { setColor(c); setSaved(false); }}
                className={`h-9 w-9 rounded-full ${color === c ? "ring-2 ring-offset-2 ring-foreground" : ""}`}
                style={{ background: c }}
                aria-label={c}
              />
            ))}
          </div>
        </div>
        <p className="text-sm text-muted">{profile.email} · {profile.role}</p>
        <button className="btn">{saved ? "✓ Saved" : "Save"}</button>
      </form>

      <form onSubmit={changePassword} className="card flex flex-col gap-3">
        <h2 className="h2">🔑 Mot de passe</h2>
        <input
          className="input"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          placeholder="Nouveau mot de passe (8 caractères min.)"
          value={newPassword}
          onChange={(e) => { setNewPassword(e.target.value); setPwMessage(null); }}
        />
        <button className="btn">Changer le mot de passe</button>
        {pwMessage && <p className="text-sm text-muted">{pwMessage}</p>}
      </form>

      <section className="card text-sm">
        <h2 className="h2 mb-2">📱 Put it on your home screen</h2>
        <p><b>iPhone:</b> open in Safari → Share → “Add to Home Screen”.</p>
        <p className="mt-1"><b>Android:</b> open in Chrome → ⋮ menu → “Install app”.</p>
      </section>

      <button className="btn-ghost text-danger" onClick={signOut}>Sign out</button>
    </div>
  );
}
