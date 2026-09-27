"use client";

import { KidProvider } from "@/components/kid-context";

export default function KidsLayout({ children }: { children: React.ReactNode }) {
  return <KidProvider>{children}</KidProvider>;
}
