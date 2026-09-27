"use client";

import { useFamily } from "./family-context";

export function MemberSelect({ value, onChange, placeholder = "Nobody" }: { value: string | null; onChange: (v: string | null) => void; placeholder?: string }) {
  const { members } = useFamily();
  return (
    <select className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{placeholder}</option>
      {members.map((m) => (
        <option key={m.id} value={m.id}>{m.emoji} {m.name}</option>
      ))}
    </select>
  );
}

export function MemberBadge({ id }: { id: string | null }) {
  const { memberById } = useFamily();
  const m = memberById(id);
  if (!m) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
      <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: m.color }} />
      {m.name}
    </span>
  );
}
