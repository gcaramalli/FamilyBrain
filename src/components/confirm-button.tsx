"use client";

import { useEffect, useState } from "react";

// Destructive action that can't be undone: the first tap arms it ("Tap again
// to delete"), a second tap within a few seconds runs it. Replaces confirm().
export function ConfirmButton({
  children,
  armed,
  onConfirm,
  className = "",
}: {
  children: React.ReactNode;
  armed: React.ReactNode;
  onConfirm: () => void | Promise<void>;
  className?: string;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => setReady(false), 4000);
    return () => clearTimeout(id);
  }, [ready]);
  return (
    <button
      type="button"
      className={`${className} ${ready ? "rounded-lg bg-danger px-2 font-semibold text-white" : "text-danger"}`}
      onClick={async () => {
        if (!ready) return setReady(true);
        setReady(false);
        await onConfirm();
      }}
    >
      {ready ? armed : children}
    </button>
  );
}
