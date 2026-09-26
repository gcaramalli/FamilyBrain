"use client";

import { createContext, useContext, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Family, Member, Profile } from "@/lib/types";

type FamilyContextValue = {
  profile: Profile;
  family: Family;
  members: Member[];
  supabase: ReturnType<typeof createClient>;
  memberById: (id: string | null | undefined) => Member | undefined;
  // "Added by Jennie" — null when it was me or unknown.
  addedBy: (createdBy: string | null | undefined) => string | null;
};

const FamilyContext = createContext<FamilyContextValue | null>(null);

export function FamilyProvider({
  profile,
  family,
  members,
  children,
}: {
  profile: Profile;
  family: Family;
  members: Member[];
  children: React.ReactNode;
}) {
  const value = useMemo(() => {
    const supabase = createClient();
    return {
      profile,
      family,
      members,
      supabase,
      memberById: (id: string | null | undefined) => members.find((m) => m.id === id),
      addedBy: (createdBy: string | null | undefined) =>
        createdBy && createdBy !== profile.id ? members.find((m) => m.profile_id === createdBy)?.name ?? null : null,
    };
  }, [profile, family, members]);

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

export function useFamily() {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error("useFamily must be used inside <FamilyProvider>");
  return ctx;
}
