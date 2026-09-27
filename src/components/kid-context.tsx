"use client";

import { createContext, useContext, useState } from "react";
import { useFamily } from "./family-context";
import { ageInMonths } from "@/lib/dates";
import type { Member } from "@/lib/types";

// Which kid the kid tab is showing, kept while moving between its tiles.
const KidContext = createContext<{ kid: Member | undefined; setKidId: (id: string) => void } | null>(null);

export function KidProvider({ children }: { children: React.ReactNode }) {
  const { kids } = useFamily();
  const [kidId, setKidId] = useState<string | null>(kids[0]?.id ?? null);
  const kid = kids.find((k) => k.id === kidId) ?? kids[0];
  return <KidContext.Provider value={{ kid, setKidId }}>{children}</KidContext.Provider>;
}

export function useKid() {
  const ctx = useContext(KidContext);
  if (!ctx) throw new Error("useKid must be used inside <KidProvider>");
  return ctx;
}

// "18 months", "2 years 3 months".
export function useKidAge() {
  const { t } = useFamily();
  return (kid: Member) => {
    if (!kid.birthdate) return null;
    const m = ageInMonths(kid.birthdate);
    if (m < 24) return m === 1 ? t("1 month") : t("{n} months", { n: m });
    const y = Math.floor(m / 12);
    const rest = m % 12;
    const years = t("{n} years", { n: y });
    return rest ? `${years} ${rest === 1 ? t("1 month") : t("{n} months", { n: rest })}` : years;
  };
}
