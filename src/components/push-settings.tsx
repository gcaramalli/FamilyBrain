"use client";

import { useEffect, useState } from "react";
import { useFamily } from "./family-context";

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

type Status = "loading" | "unsupported" | "ios-install" | "off" | "on" | "denied";

// Reminders on this phone: the evening before ("tomorrow you pick up Charlie")
// and when the other parent gives you something to do.
export function PushSettings() {
  const { supabase, t } = useFamily();
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        // iPhone only offers web push to apps added to the home screen.
        return setStatus(ios && !standalone ? "ios-install" : "unsupported");
      }
      if (Notification.permission === "denied") return setStatus("denied");
      const reg = await navigator.serviceWorker.ready;
      setStatus((await reg.pushManager.getSubscription()) ? "on" : "off");
    })();
  }, []);

  if (!KEY) return null; // not configured on the server

  async function turnOn() {
    setBusy(true);
    try {
      if ((await Notification.requestPermission()) !== "granted") return setStatus("denied");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(KEY!) });
      const json = sub.toJSON();
      await supabase.from("push_subscriptions").upsert({ endpoint: sub.endpoint, p256dh: json.keys!.p256dh, auth: json.keys!.auth });
      setStatus("on");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
    setStatus("off");
    setBusy(false);
  }

  return (
    <section className="card flex flex-col gap-2">
      <h2 className="h2">🔔 {t("Reminders")}</h2>
      <p className="text-sm text-muted">{t("The evening before: what you do tomorrow, and drop-offs or pick-ups nobody has taken. Also when someone gives you something to do.")}</p>
      {status === "on" && (
        <button className="btn-ghost py-3" onClick={turnOff} disabled={busy}>✓ {t("On for this phone · turn off")}</button>
      )}
      {status === "off" && (
        <button className="btn" onClick={turnOn} disabled={busy}>{t("Turn on for this phone")}</button>
      )}
      {status === "denied" && <p className="text-sm">{t("Notifications are blocked for this app. Allow them in your phone's settings, then come back here.")}</p>}
      {status === "ios-install" && <p className="text-sm">{t("On iPhone, first add Hembrain to your home screen (see below), open it from there, then turn reminders on.")}</p>}
      {status === "unsupported" && <p className="text-sm">{t("This browser can't receive reminders.")}</p>}
    </section>
  );
}
