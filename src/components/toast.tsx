"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useFamily } from "./family-context";

type Toast = { id: number; message: string; undo?: () => void | Promise<void> };
type ToastFn = (message: string, undo?: () => void | Promise<void>) => void;

const ToastContext = createContext<ToastFn>(() => {});

// "Deleted · Undo" bar above the tab bar. Replaces confirm() dialogs:
// act immediately, offer a way back for a few seconds.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { t } = useFamily();
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback<ToastFn>((message, undo) => {
    if (timer.current) clearTimeout(timer.current);
    const id = Date.now();
    setToast({ id, message, undo });
    timer.current = setTimeout(() => setToast((x) => (x?.id === id ? null : x)), undo ? 6000 : 3000);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4">
          <div role="status" className="pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-xl bg-foreground px-4 py-3 text-sm text-background shadow-lg">
            <span className="min-w-0 truncate">{toast.message}</span>
            {toast.undo && (
              <button
                className="shrink-0 font-semibold underline underline-offset-2"
                onClick={async () => {
                  const undo = toast.undo;
                  setToast(null);
                  await undo?.();
                }}
              >
                {t("Undo")}
              </button>
            )}
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
