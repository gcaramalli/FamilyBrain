"use client";

import { ClaudeConnector } from "@/components/claude-connector";
import { useFamily } from "@/components/family-context";
import { PageHeader } from "@/components/page-header";
import { PushSettings } from "@/components/push-settings";

// Set once, looked for later: reminders on this phone, AI assistants, home screen.
export default function ConnectionsPage() {
  const { t } = useFamily();
  return (
    <div className="flex flex-col gap-4">
      <PageHeader back="/me" title={t("Reminders & AI")} />
      <PushSettings />
      <ClaudeConnector />
      <section className="card text-sm">
        <h2 className="h2 mb-2">{t("Put it on your home screen")}</h2>
        <p>{t("iPhone: open in Safari → Share → “Add to Home Screen”.")}</p>
        <p className="mt-1">{t("Android: open in Chrome → ⋮ menu → “Install app”.")}</p>
      </section>
    </div>
  );
}
