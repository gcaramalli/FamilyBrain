"use client";

import { useState } from "react";
import { ConfirmButton } from "./confirm-button";
import { useFamily } from "./family-context";
import type { Member } from "@/lib/types";

// Name, emoji, colour, birthday and notes of one person. Used in Family
// settings for adults and in the kid's own tab for kids.
export function MemberEditor({ member, onChange }: { member: Member; onChange: () => void }) {
  const { supabase, t } = useFamily();
  const [m, setM] = useState(member);
  const [dirty, setDirty] = useState(false);
  const set = <K extends keyof Member>(k: K, v: Member[K]) => {
    setM((x) => ({ ...x, [k]: v }));
    setDirty(true);
  };

  async function save() {
    await supabase.from("members").update({ name: m.name, emoji: m.emoji, color: m.color, birthdate: m.birthdate, notes: m.notes }).eq("id", m.id);
    setDirty(false);
    onChange();
  }

  async function remove() {
    await supabase.from("members").delete().eq("id", m.id);
    onChange();
  }

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex gap-2">
        <input className="input w-14 text-center" value={m.emoji} onChange={(e) => set("emoji", e.target.value)} />
        <input className="input" value={m.name} onChange={(e) => set("name", e.target.value)} />
        <input type="color" className="h-11 w-11 shrink-0 rounded-xl border border-border" value={m.color} onChange={(e) => set("color", e.target.value)} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <input className="input" type="date" value={m.birthdate ?? ""} onChange={(e) => set("birthdate", e.target.value || null)} />
        <span className="self-center text-xs text-muted">{m.profile_id ? t("Has an account") : t("No account")}</span>
      </div>
      <textarea className="input mt-2" placeholder={t("Notes (allergies, sizes, school…)")} value={m.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)} />
      <div className="mt-2 flex gap-2">
        <button className="btn flex-1" onClick={save} disabled={!dirty}>{t("Save")}</button>
        {!m.profile_id && (
          <ConfirmButton className="btn-ghost" armed={t("Remove {name}?", { name: m.name })} onConfirm={remove}>{t("Remove")}</ConfirmButton>
        )}
      </div>
    </div>
  );
}
