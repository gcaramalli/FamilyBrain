"use client";

import { useCallback, useEffect, useState } from "react";
import { useFamily } from "./family-context";

type Token = { id: string; label: string; created_at: string; last_used_at: string | null };

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

// Personal Claude connector links. The secret is shown once; only its hash
// is stored.
export function ClaudeConnector() {
  const { supabase, profile } = useFamily();
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
    const label = prompt("Name this link (e.g. Claude on my phone)", "Claude") || "Claude";
    const { error } = await supabase.from("connector_tokens").insert({ profile_id: profile.id, token_hash: await sha256Hex(token), label });
    if (error) return alert(error.message);
    setNewUrl(`${window.location.origin}/api/mcp/${token}`);
    setCopied(false);
    load();
  }

  async function revoke(t: Token) {
    if (!confirm(`Revoke "${t.label}"? Claude will lose access through this link.`)) return;
    await supabase.from("connector_tokens").delete().eq("id", t.id);
    load();
  }

  async function copy() {
    if (!newUrl) return;
    try {
      await navigator.clipboard.writeText(newUrl);
      setCopied(true);
    } catch {
      prompt("Copy this link:", newUrl);
    }
  }

  return (
    <section className="card flex flex-col gap-3">
      <h2 className="h2">🤖 Connect Claude</h2>
      <p className="text-sm text-muted">
        Lets your Claude app read and add to the calendar, lists, recipes and notes, as you. In Claude: Settings → Connectors →
        Add custom connector → paste your link → Authentication: none.
      </p>

      {newUrl && (
        <div className="rounded-xl border border-accent bg-accent-soft p-3 text-sm">
          <p className="font-medium">Your link — shown only once:</p>
          <p className="mt-1 break-all font-mono text-xs">{newUrl}</p>
          <button className="btn mt-2 w-full" onClick={copy}>{copied ? "✓ Copied" : "Copy link"}</button>
          <p className="mt-2 text-xs text-muted">It works like a password: paste it only into Claude, never in a chat or screenshot.</p>
        </div>
      )}

      {tokens.length > 0 && (
        <ul className="divide-y divide-border text-sm">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center justify-between py-2">
              <span>
                {t.label}
                <span className="block text-xs text-muted">
                  {t.last_used_at ? `last used ${new Date(t.last_used_at).toLocaleString()}` : "never used"}
                </span>
              </span>
              <button className="text-danger" onClick={() => revoke(t)}>Revoke</button>
            </li>
          ))}
        </ul>
      )}

      <button className="btn-ghost" onClick={create}>+ Create a Claude link</button>
    </section>
  );
}
