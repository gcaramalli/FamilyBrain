"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmButton } from "@/components/confirm-button";
import { useFamily } from "@/components/family-context";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { fmtDate } from "@/lib/dates";
import Link from "next/link";
import { MemberEditor } from "@/components/member-editor";
import { PageHeader } from "@/components/page-header";
import type { Invite, Profile } from "@/lib/types";

export default function AdminPage() {
  const { supabase, profile, family, members, t } = useFamily();
  const router = useRouter();
  const toast = useToast();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [familyName, setFamilyName] = useState(family.name);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [inviteMember, setInviteMember] = useState<string>("");

  const load = useCallback(async () => {
    const [p, i] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at"),
      supabase.from("invites").select("*").order("created_at"),
    ]);
    setProfiles((p.data ?? []) as Profile[]);
    setInvites((i.data ?? []) as Invite[]);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  if (profile.role !== "admin") {
    return <p className="text-muted">{t("Only family admins can see this page.")}</p>;
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
    const { data, error } = await supabase
      .from("invites")
      .insert({ email: inviteEmail.trim().toLowerCase(), family_id: family.id, role: inviteRole, member_id: inviteMember || null })
      .select()
      .single<Invite>();
    if (error) return toast(error.message);
    setInviteEmail("");
    setInviteMember("");
    await load();
    if (data) shareInvite(data);
  }

  function inviteLink(i: Invite) {
    return `${window.location.origin}/signup?invite=${i.code}`;
  }

  // Opens the phone's share sheet (SMS, WhatsApp…) or copies the link.
  async function shareInvite(i: Invite) {
    const url = inviteLink(i);
    try {
      if (navigator.share) {
        await navigator.share({ title: t("Join {family} on Hembrain", { family: family.name }), url });
        return;
      }
    } catch {
      // Share sheet dismissed: fall back to copying.
    }
    try {
      await navigator.clipboard.writeText(url);
      toast(t("Invite link copied. Send it by SMS or WhatsApp."));
    } catch {
      setShareUrl(url); // shown as selectable text
    }
  }

  async function addMember(name: string, emoji: string) {
    // Pick a colour nobody uses yet.
    const color = FREE_COLORS.find((c) => !members.some((m) => m.color.toLowerCase() === c)) ?? "#d97706";
    await supabase.from("members").insert({ name, emoji: emoji || "👶", color });
    setAdding(false);
    refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader back="/me" title={t("Family settings")} />

      <form onSubmit={saveFamily} className="card flex flex-col gap-2">
        <h2 className="h2">{t("Family")}</h2>
        <div className="flex gap-2">
          <input className="input" value={familyName} onChange={(e) => setFamilyName(e.target.value)} />
          <button className="btn">{t("Save")}</button>
        </div>
      </form>

      <section className="card flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="h2">{t("Family members")}</h2>
          <button className="btn-ghost" onClick={() => setAdding(true)}>+ {t("Person")}</button>
        </div>
        <p className="text-xs text-muted">{t("People who appear on the calendar. Kids don't need an account.")}</p>
        {members.map((m) =>
          m.profile_id ? (
            <MemberEditor key={m.id} member={m} onChange={refresh} />
          ) : (
            // Kids are set up where they are used: their tab.
            <Link key={m.id} href="/kids" className="flex min-h-11 items-center justify-between rounded-xl border border-border px-3 text-sm">
              <span>{m.emoji} {m.name}</span>
              <span className="text-muted">{t("In the {name} tab", { name: m.name })} →</span>
            </Link>
          ),
        )}
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="h2">{t("Accounts & invites")}</h2>
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
                <option value="admin">{t("admin")}</option>
                <option value="member">{t("member")}</option>
              </select>
            </li>
          ))}
          {invites.map((i) => (
            <li key={i.email} className="flex items-center justify-between py-2 text-sm">
              <span>
                ✉️ {i.email} <span className="text-muted">({t(i.role)}, {t("until {date}", { date: fmtDate(i.expires_at, { day: "numeric", month: "short" }) })})</span>
              </span>
              <span className="flex gap-3">
                <button className="text-accent" onClick={() => shareInvite(i)}>{t("Share link")}</button>
                <ConfirmButton armed={t("Cancel invite?")} onConfirm={async () => { await supabase.from("invites").delete().eq("code", i.code); load(); }}>{t("Cancel")}</ConfirmButton>
              </span>
            </li>
          ))}
        </ul>
        {shareUrl && (
          <div className="rounded-xl bg-accent-soft p-3 text-sm">
            <p className="font-medium">{t("Copy this invite link:")}</p>
            <input className="input mt-1 font-mono text-xs" readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
          </div>
        )}
        <form onSubmit={invite} className="flex flex-col gap-2">
          <input className="input" type="email" required placeholder={t("Their email")} value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
          <div className="flex gap-2">
            <select className="input" value={inviteMember} onChange={(e) => setInviteMember(e.target.value)}>
              <option value="">{t("New person")}</option>
              {members.filter((m) => !m.profile_id).map((m) => (
                <option key={m.id} value={m.id}>{t("For {name}", { name: `${m.emoji} ${m.name}` })}</option>
              ))}
            </select>
            <select className="input w-32" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as "member" | "admin")}>
              <option value="member">{t("member")}</option>
              <option value="admin">{t("admin")}</option>
            </select>
          </div>
          <button className="btn">{t("Invite")}</button>
        </form>
        <p className="text-xs text-muted">
          {t("Send them the private link (SMS/WhatsApp; single use, 14 days). They create their account from it and land in this family.")}
        </p>
      </section>

      <Sheet open={adding} onClose={() => setAdding(false)} title={t("Add a person")}>
        {adding && <AddPerson onAdd={addMember} />}
      </Sheet>

    </div>
  );
}

const FREE_COLORS = ["#d97706", "#059669", "#0891b2", "#7c3aed", "#dc2626", "#475569", "#db2777", "#4f46e5"];

function AddPerson({ onAdd }: { onAdd: (name: string, emoji: string) => void }) {
  const { t } = useFamily();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("👶");
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onAdd(name.trim(), emoji.trim());
      }}
    >
      <div className="flex gap-2">
        <input className="input w-16 text-center text-xl" value={emoji} onChange={(e) => setEmoji(e.target.value)} aria-label={t("Emoji")} />
        <input className="input" placeholder={t("Name")} value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </div>
      <p className="text-xs text-muted">{t("Kids don't need an account. To give an adult one, invite them below after adding.")}</p>
      <button className="btn">{t("Add")}</button>
    </form>
  );
}
