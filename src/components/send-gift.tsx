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
  const [sent, setSent] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (people.length === 0) return null;

  async function send() {
    if (!to) return;
    setBusy(true);
    const { data, error } = await supabase.from("gifts").insert({ to_profile: to, emoji, message: message.trim() || null }).select("id").single();
    setBusy(false);
    if (error || !data) return toast(error?.message ?? t("Could not send"));
    setSent({ id: data.id, name: people.find((p) => p.profile_id === to)?.name ?? "" });
  }

  // Regret: take it back, as long as it hasn't been unwrapped. The note is kept
  // in the field so it can be fixed and sent again.
  async function takeBack() {
    if (!sent) return;
    const { data } = await supabase.from("gifts").delete().eq("id", sent.id).is("opened_at", null).select("id");
    if (data?.length) {
      setSent(null);
      toast(t("Taken back. {name} will never know.", { name: sent.name }));
    } else {
      toast(t("Too late, {name} already unwrapped it.", { name: sent.name }));
      setSent(null);
      setMessage("");
    }
  }

  if (sent) {
    return (
      <section className="card text-center">
        <div className="animate-gift-pop text-5xl">💌</div>
        <p className="mt-2 font-medium">{t("Sent to {name}!", { name: sent.name })}</p>
        <p className="text-sm text-muted">{t("They'll unwrap it next time they open Hembrain.")}</p>
        <div className="mt-3 flex justify-center gap-4">
          <button className="min-h-9 text-sm text-muted underline" onClick={takeBack}>{t("Take it back")}</button>
          <button
            className="min-h-9 text-sm font-medium"
            onClick={() => {
              setSent(null);
              setMessage("");
            }}
          >
            {t("Send another")}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="card flex flex-col gap-3">
      <h2 className="h2">{t("Send a little something")}</h2>
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
            className={`rounded-xl py-2 text-2xl transition-transform ${emoji === g.emoji ? "scale-110 bg-accent-soft" : "opacity-70"}`}
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
