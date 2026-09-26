"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFamily } from "@/components/family-context";
import type { Invite, List, Member, Profile } from "@/lib/types";

type Purchase = { id: string; item_name: string; purchased_at: string; source: string };

export default function AdminPage() {
  const { supabase, profile, family, members } = useFamily();
  const router = useRouter();
  const [familyName, setFamilyName] = useState(family.name);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [bought, setBought] = useState("");

  const load = useCallback(async () => {
    const [p, i, l, pu] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at"),
      supabase.from("invites").select("*").order("created_at"),
      supabase.from("lists").select("*").order("position"),
      supabase.from("purchases").select("id, item_name, purchased_at, source").order("purchased_at", { ascending: false }).limit(30),
    ]);
    setProfiles((p.data ?? []) as Profile[]);
    setInvites((i.data ?? []) as Invite[]);
    setLists((l.data ?? []) as List[]);
    setPurchases((pu.data ?? []) as Purchase[]);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  if (profile.role !== "admin") {
    return <p className="text-muted">Only family admins can see this page.</p>;
  }

  const refresh = () => {
    load();
    router.refresh();
  };

  async function saveFamily(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from("families").update({ name: familyName }).eq("id", family.id);
    refresh();
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("invites").insert({ email: inviteEmail.trim().toLowerCase(), family_id: family.id });
    if (error) return alert(error.message);
    setInviteEmail("");
    load();
  }

  async function addMember() {
    const name = prompt("Name? (e.g. Charlie)");
    if (!name) return;
    await supabase.from("members").insert({ name, emoji: "👶", color: "#d97706" });
    refresh();
  }

  async function logPurchase(e: React.FormEvent) {
    e.preventDefault();
    if (!bought.trim()) return;
    await supabase.from("purchases").insert({ item_name: bought.trim(), source: "manual" });
    setBought("");
    load();
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="h1">Admin</h1>

      <form onSubmit={saveFamily} className="card flex flex-col gap-2">
        <h2 className="h2">Family</h2>
        <div className="flex gap-2">
          <input className="input" value={familyName} onChange={(e) => setFamilyName(e.target.value)} />
          <button className="btn">Save</button>
        </div>
      </form>

      <section className="card flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="h2">Family members</h2>
          <button className="btn-ghost" onClick={addMember}>+ Person</button>
        </div>
        <p className="text-xs text-muted">People who appear on the calendar. Kids don&apos;t need an account.</p>
        {members.map((m) => <MemberEditor key={m.id} member={m} onChange={refresh} />)}
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="h2">Accounts & invites</h2>
        <ul className="divide-y divide-border">
          {profiles.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2 text-sm">
              <span>{p.display_name} <span className="text-muted">({p.email})</span></span>
              <select
                className="rounded-lg border border-border bg-surface px-2 py-1"
                value={p.role}
                disabled={p.id === profile.id}
                onChange={async (e) => {
                  await supabase.from("profiles").update({ role: e.target.value }).eq("id", p.id);
                  load();
                }}
              >
                <option value="admin">admin</option>
                <option value="member">member</option>
              </select>
            </li>
          ))}
          {invites.map((i) => (
            <li key={i.email} className="flex items-center justify-between py-2 text-sm">
              <span>✉️ {i.email} <span className="text-muted">(invited)</span></span>
              <button className="text-danger" onClick={async () => { await supabase.from("invites").delete().eq("email", i.email); load(); }}>Cancel</button>
            </li>
          ))}
        </ul>
        <form onSubmit={invite} className="flex gap-2">
          <input className="input" type="email" required placeholder="jenny@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
          <button className="btn">Invite</button>
        </form>
        <p className="text-xs text-muted">They sign in on the app with this email and join the family automatically.</p>
      </section>

      <section className="card flex flex-col gap-2">
        <h2 className="h2">Lists</h2>
        {lists.map((l) => (
          <div key={l.id} className="flex items-center justify-between text-sm">
            <span>{l.kind === "grocery" ? "🛒" : "✅"} {l.name}</span>
            <div className="flex gap-3">
              <button className="text-accent" onClick={async () => { const n = prompt("New name", l.name); if (n) { await supabase.from("lists").update({ name: n }).eq("id", l.id); load(); } }}>Rename</button>
              <button className="text-danger" onClick={async () => { if (confirm(`Delete "${l.name}" and all its items?`)) { await supabase.from("lists").delete().eq("id", l.id); load(); } }}>Delete</button>
            </div>
          </div>
        ))}
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="h2">Purchase history</h2>
        <p className="text-xs text-muted">Checked-off shopping items land here automatically. Log things bought outside the list so the app learns how often you need them.</p>
        <form onSubmit={logPurchase} className="flex gap-2">
          <input className="input" placeholder="I just bought… (toothpaste)" value={bought} onChange={(e) => setBought(e.target.value)} />
          <button className="btn">Log</button>
        </form>
        <ul className="divide-y divide-border text-sm">
          {purchases.map((p) => (
            <li key={p.id} className="flex justify-between py-1.5">
              <span>{p.item_name}</span>
              <span className="text-muted">{new Date(p.purchased_at).toLocaleDateString()} · {p.source}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function MemberEditor({ member, onChange }: { member: Member; onChange: () => void }) {
  const { supabase } = useFamily();
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
    if (!confirm(`Remove ${m.name}?`)) return;
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
        <span className="self-center text-xs text-muted">{m.profile_id ? "Has an account" : "No account"}</span>
      </div>
      <textarea className="input mt-2" placeholder="Notes (allergies, sizes, school…)" value={m.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)} />
      <div className="mt-2 flex gap-2">
        <button className="btn flex-1" onClick={save} disabled={!dirty}>Save</button>
        {!m.profile_id && <button className="btn-ghost text-danger" onClick={remove}>Remove</button>}
      </div>
    </div>
  );
}
