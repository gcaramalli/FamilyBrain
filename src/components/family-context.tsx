"use client";

import { createContext, useContext, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { setDateLocale } from "@/lib/dates";
import { BCP47, isLocale, translator, type Locale, type T } from "@/lib/i18n";
import type { Family, Member, Profile } from "@/lib/types";

type FamilyContextValue = {
  profile: Profile;
  family: Family;
  members: Member[];
  // Everyone with an account (parents) and everyone without (kids).
  adults: Member[];
  kids: Member[];
  me: Member | undefined;
  supabase: ReturnType<typeof createClient>;
  memberById: (id: string | null | undefined) => Member | undefined;
  // "Added by Jennie" — null when it was me or unknown.
  addedBy: (createdBy: string | null | undefined) => string | null;
  locale: Locale;
  t: T;
  // Server features that need configuration (Anthropic API key).
  ai: boolean;
  // Level 3: sees usage stats across all families (/stats).
  superAdmin: boolean;
};

const FamilyContext = createContext<FamilyContextValue | null>(null);

export function FamilyProvider({
  profile,
  family,
  members,
  ai,
  superAdmin = false,
  children,
}: {
  profile: Profile;
  family: Family;
  members: Member[];
  ai: boolean;
  superAdmin?: boolean;
  children: React.ReactNode;
}) {
  const value = useMemo(() => {
    const supabase = createClient();
    const locale: Locale = isLocale(profile.locale) ? profile.locale : "en";
    const t = translator(locale);
    setDateLocale(BCP47[locale], { today: t("Today"), tomorrow: t("Tomorrow"), yesterday: t("Yesterday") });
    return {
      profile,
      family,
      members,
      adults: members.filter((m) => m.profile_id),
      kids: members.filter((m) => !m.profile_id),
      me: members.find((m) => m.profile_id === profile.id),
      supabase,
      memberById: (id: string | null | undefined) => members.find((m) => m.id === id),
      addedBy: (createdBy: string | null | undefined) =>
        createdBy && createdBy !== profile.id ? members.find((m) => m.profile_id === createdBy)?.name ?? null : null,
      locale,
      t,
      ai,
      superAdmin,
    };
  }, [profile, family, members, ai, superAdmin]);

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

export function useFamily() {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error("useFamily must be used inside <FamilyProvider>");
  return ctx;
}
