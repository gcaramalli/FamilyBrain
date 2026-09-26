"use client";

import { useState } from "react";
import { useFamily } from "./family-context";
import { useToast } from "./toast";

const GIFTS = [
  { emoji: "❤️", hint: "Love you" },
  { emoji: "🤗", hint: "Hug" },
  { emoji: "☕", hint: "Coffee's on me" },
  { emoji: "🌟", hint: "You're a star" },
  { emoji: "💪", hint: "You got this" },
  { emoji: "🍫", hint: "A treat" },
  { emoji: "🌷", hint: "For you" },
  { emoji: "😘", hint: "Kiss" },
];

// "À toi, à moi": send a little gift that the other person unwraps when
// they next open the app.
export function SendGift() {
  const { supabase, profile, members, t } = useFamily();
  const toast = useToast();
  const people = members.filter((m) => m.profile_id && m.profile_id !== profile.id);
  const [to, setTo] = useState<string | null>(people.length === 1 ? people[0].profile_id : null);
  const [emoji, setEmoji] = useState("❤️");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (people.length === 0) return null;

  async function send() {
    if (!to) return;
    setBusy(true);
    const { error } = await supabase.from("gifts").insert({ to_profile: to, emoji, message: message.trim() || null });
    setBusy(false);
    if (error) return toast(error.message);
    setSent(people.find((p) => p.profile_id === to)?.name ?? "");
    setMessage("");
  }

  if (sent) {
    return (
      <section className="card text-center">
        <div className="animate-gift-pop text-5xl">💌</div>
        <p className="mt-2 font-medium">{t("Sent to {name}!", { name: sent })}</p>
        <p className="text-sm text-muted">{t("They'll unwrap it next time they open Hembrain.")}</p>
        <button className="mt-3 min-h-9 text-sm text-accent" onClick={() => setSent(null)}>{t("Send another")}</button>
      </section>
    );
  }

  return (
    <section className="card flex flex-col gap-3">
      <h2 className="h2">💌 {t("Send a little something")}</h2>
      {people.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {people.map((p) => (
            <button
              key={p.id}
              onClick={() => setTo(p.profile_id)}
              className={`chip-toggle ${to === p.profile_id ? "chip-on" : ""}`}
            >
              {p.emoji} {p.name}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-8 gap-1">
        {GIFTS.map((g) => (
          <button
            key={g.emoji}
            title={t(g.hint)}
            onClick={() => setEmoji(g.emoji)}
            className={`rounded-xl py-2 text-2xl ${emoji === g.emoji ? "bg-accent-soft ring-2 ring-foreground" : ""}`}
          >
            {g.emoji}
          </button>
        ))}
      </div>
      <input
        className="input"
        maxLength={140}
        placeholder={t(GIFTS.find((g) => g.emoji === emoji)?.hint ?? "A little note (optional)")}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <button className="btn" onClick={send} disabled={!to || busy}>
        {busy ? t("Wrapping…") : to ? t("Send {emoji} to {name}", { emoji, name: people.find((p) => p.profile_id === to)?.name ?? "" }) : t("Send {emoji}", { emoji })}
      </button>
    </section>
  );
}
