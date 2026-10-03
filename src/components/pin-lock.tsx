"use client";

import { Lock } from "lucide-react";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useFamily } from "./family-context";
import { Sheet } from "./sheet";

// A code in front of the private tiles I choose (and my private papers).
// Other accounts can't read them anyway (RLS); this keeps them closed when
// someone else holds my unlocked phone. The code is checked by the database
// (private_pin_check, 0021); once entered, everything stays open until the
// app has been in the background for a minute, or "Lock now".

const RELOCK_AFTER_MS = 60_000;
let unlocked = false;
let hiddenAt = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function setUnlocked(value: boolean) {
  unlocked = value;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") hiddenAt = Date.now();
    else if (unlocked && hiddenAt && Date.now() - hiddenAt > RELOCK_AFTER_MS) setUnlocked(false);
  });
}

// Whether this account has a code (null while loading), and whether it's open right now.
let pinKnown: boolean | null = null;

export function usePin() {
  const { supabase } = useFamily();
  const [hasPin, setHasPin] = useState<boolean | null>(pinKnown);
  const isOpen = useSyncExternalStore(subscribe, () => unlocked, () => false);

  const refresh = useCallback(async () => {
    const { data } = await supabase.rpc("private_pin_status");
    pinKnown = !!data;
    setHasPin(pinKnown);
  }, [supabase]);

  useEffect(() => {
    refresh();
    // Other components (the settings sheet) change the code: keep in step.
    return subscribe(() => setHasPin(pinKnown));
  }, [refresh]);

  const check = useCallback(
    async (pin: string): Promise<"ok" | "wrong" | "wait"> => {
      const { data, error } = await supabase.rpc("private_pin_check", { pin });
      if (error) return "wrong";
      if (data === "ok") setUnlocked(true);
      return data as "ok" | "wrong" | "wait";
    },
    [supabase],
  );

  const setPin = useCallback(
    async (pin: string) => {
      const { error } = await supabase.rpc("private_pin_set", { pin });
      if (error) return error.message;
      pinKnown = true;
      setUnlocked(true);
      return null;
    },
    [supabase],
  );

  const clearPin = useCallback(async () => {
    await supabase.rpc("private_pin_clear");
    pinKnown = false;
    setUnlocked(false);
  }, [supabase]);

  return {
    hasPin,
    // Open when there is no code, or it was entered.
    open: hasPin === false || isOpen,
    check,
    setPin,
    clearPin,
    lock: () => setUnlocked(false),
  };
}

// The code pad, with "Forgot the code?" (account password → code removed).
export function PinPad({ onUnlocked }: { onUnlocked?: () => void }) {
  const { supabase, t } = useFamily();
  const { check, clearPin } = usePin();
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);
  const [password, setPassword] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = await check(pin);
    setPin("");
    if (result === "ok") {
      setMessage(null);
      onUnlocked?.();
    } else setMessage(result === "wait" ? t("Too many tries. Wait 5 minutes.") : t("Wrong code."));
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email;
    if (!email) return setMessage(t("Wrong password."));
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setPassword("");
    if (error) return setMessage(t("Wrong password."));
    await clearPin();
    setMessage(null);
    setForgot(false);
    onUnlocked?.();
  }

  if (forgot) {
    return (
      <form onSubmit={reset} className="flex flex-col gap-3">
        <p className="text-sm text-muted">{t("Enter your account password: the code is removed and you can set a new one.")}</p>
        <input className="input" type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("Password")} />
        {message && <p className="text-sm text-danger">{message}</p>}
        <button className="btn" disabled={!password}>{t("Remove the code")}</button>
        <button type="button" className="text-sm text-muted underline" onClick={() => { setForgot(false); setMessage(null); }}>{t("Back")}</button>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col items-center gap-3 py-2">
      <Lock size={28} className="text-muted" aria-hidden />
      <input
        className="input max-w-48 text-center text-2xl tracking-[0.5em]"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        pattern="[0-9]*"
        maxLength={8}
        autoFocus
        aria-label={t("Code")}
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
      />
      {message && <p className="text-sm text-danger">{message}</p>}
      <button className="btn" disabled={pin.length < 4}>{t("Unlock")}</button>
      <button type="button" className="text-sm text-muted underline" onClick={() => { setForgot(true); setMessage(null); }}>{t("Forgot the code?")}</button>
    </form>
  );
}

// Shows the children only once unlocked (or when this part isn't locked).
export function PinGate({ locked = true, children }: { locked?: boolean; children: React.ReactNode }) {
  const { open, hasPin } = usePin();
  if (!locked || open) return <>{children}</>;
  if (hasPin === null) return null;
  return (
    <div className="card">
      <PinPad />
    </div>
  );
}

// Asks for the code, then runs `then` (open a tile, follow a link).
export function PinSheet({ request, onClose }: { request: (() => void) | null; onClose: () => void }) {
  const { t } = useFamily();
  return (
    <Sheet open={!!request} onClose={onClose} title={t("Locked")}>
      {request && (
        <PinPad
          onUnlocked={() => {
            onClose();
            request();
          }}
        />
      )}
    </Sheet>
  );
}
