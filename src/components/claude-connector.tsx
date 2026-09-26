"use client";

import { useCallback, useEffect, useState } from "react";
import { ConfirmButton } from "./confirm-button";
import { useFamily } from "./family-context";
import { useToast } from "./toast";
import { fmtDateTime } from "@/lib/dates";

type Token = { id: string; label: string; created_at: string; last_used_at: string | null };

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

// Personal Claude connector links. The secret is shown once; only its hash
// is stored.
export function ClaudeConnector() {
  const { supabase, profile, t } = useFamily();
  const toast = useToast();
  const [label, setLabel] = useState("Claude");
  const [naming, setNaming] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [newUrl, setNewUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("connector_tokens").select("id, label, created_at, last_used_at").order("created_at");
    setTokens((data ?? []) as Token[]);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    const { error } = await supabase.from("connector_tokens").insert({ profile_id: profile.id, token_hash: await sha256Hex(token), label: label.trim() || "Claude" });
    if (error) return toast(error.message);
    setNaming(false);
    setNewUrl(`${window.location.origin}/api/mcp/${token}`);
    setCopied(false);
    load();
  }

  async function revoke(token: Token) {
    await supabase.from("connector_tokens").delete().eq("id", token.id);
    load();
  }

  async function copy() {
    if (!newUrl) return;
    try {
      await navigator.clipboard.writeText(newUrl);
      setCopied(true);
    } catch {
      setCopyFailed(true); // the link stays on screen as selectable text
    }
  }

  return (
    <section className="card flex flex-col gap-3">
      <h2 className="h2">🤖 {t("Connect Claude")}</h2>
      <p className="text-sm text-muted">
        {t("Lets your Claude app read and add to the calendar, lists, recipes and notes, as you. In Claude: Settings → Connectors → Add custom connector → paste your link → Authentication: none.")}
      </p>

      {newUrl && (
        <div className="rounded-xl border border-foreground bg-accent-soft p-3 text-sm">
          <p className="font-medium">{t("Your link, shown only once:")}</p>
          <p className="mt-1 select-all break-all font-mono text-xs">{newUrl}</p>
          <button className="btn mt-2 w-full" onClick={copy}>{copied ? `✓ ${t("Copied")}` : t("Copy link")}</button>
          {copyFailed && <p className="mt-1 text-xs">{t("Copying isn't allowed here: press and hold the link to select it.")}</p>}
          <p className="mt-2 text-xs text-muted">{t("It works like a password: paste it only into Claude, never in a chat or screenshot.")}</p>
        </div>
      )}

      {tokens.length > 0 && (
        <ul className="divide-y divide-border text-sm">
          {tokens.map((token) => (
            <li key={token.id} className="flex items-center justify-between py-2">
              <span>
                {token.label}
                <span className="block text-xs text-muted">
                  {token.last_used_at ? t("last used {when}", { when: fmtDateTime(token.last_used_at) }) : t("never used")}
                </span>
              </span>
              <ConfirmButton className="min-h-9" armed={t("Claude loses access. Revoke?")} onConfirm={() => revoke(token)}>{t("Revoke")}</ConfirmButton>
            </li>
          ))}
        </ul>
      )}

      {naming ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("Name, e.g. Claude on my phone")} autoFocus />
          <button className="btn shrink-0">{t("Create")}</button>
        </form>
      ) : (
        <button className="btn-ghost" onClick={() => setNaming(true)}>+ {t("Create a Claude link")}</button>
      )}
    </section>
  );
}
