import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FamilyProvider } from "@/components/family-context";
import { AppShell } from "@/components/app-shell";
import type { Family, Member, Profile } from "@/lib/types";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile) {
    return (
      <main className="mx-auto max-w-sm p-6">
        <h1 className="h1">Almost there</h1>
        <p className="mt-2 text-muted">
          Your account exists but has no family profile yet. Make sure the database migration in
          <code> supabase/migrations</code> has been applied, then sign up again.
        </p>
      </main>
    );
  }

  const [{ data: family }, { data: members }] = await Promise.all([
    supabase.from("families").select("id, name").eq("id", profile.family_id).single<Family>(),
    supabase.from("members").select("*").order("created_at"),
  ]);

  return (
    <FamilyProvider profile={profile} family={family ?? { id: profile.family_id, name: "Our family" }} members={(members ?? []) as Member[]}>
      <AppShell>{children}</AppShell>
    </FamilyProvider>
  );
}
