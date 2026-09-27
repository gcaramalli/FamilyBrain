import { careTitle } from "@/lib/care";
import { BCP47, isLocale, translator } from "@/lib/i18n";
import { pushEnabled, sendPush } from "@/lib/push";
import { getSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Member } from "@/lib/types";

// "Guillaume gave you: Pick-up Charlie · Thu 16:00", sent to the other parent
// when someone makes them responsible for something. From the Kids tab also
// "Guillaume is going" and "Guillaume can't make it".
export async function POST(req: Request) {
  if (!pushEnabled()) return Response.json({ sent: 0 });
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { member_id, title, starts_at, all_day, news } = (await req.json()) as {
    member_id: string;
    title: string;
    starts_at: string;
    all_day?: boolean;
    news?: "assigned" | "going" | "cant";
  };

  // RLS: only people in my own family are visible here.
  const { data: members } = await session.supabase.from("members").select("*");
  const to = (members as Member[] | null)?.find((m) => m.id === member_id);
  const from = (members as Member[] | null)?.find((m) => m.profile_id === session.profile.id);
  if (!to?.profile_id || to.profile_id === session.profile.id) return Response.json({ sent: 0 });

  const { data: recipient } = await createAdminClient().from("profiles").select("locale").eq("id", to.profile_id).single();
  const locale = isLocale(recipient?.locale) ? recipient.locale : "en";
  const t = translator(locale);
  const kid = (members as Member[]).find((m) => !m.profile_id && (title === careTitle("dropoff", m) || title === careTitle("pickup", m)));
  const label = kid ? (title === careTitle("dropoff", kid) ? t("Drop-off {name}", { name: kid.name }) : t("Pick-up {name}", { name: kid.name })) : title;
  const when = new Date(starts_at).toLocaleString(BCP47[locale], {
    timeZone: "Europe/Stockholm",
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(all_day ? {} : { hour: "2-digit", minute: "2-digit" }),
  });

  const name = from?.name ?? session.profile.display_name;
  const sent = await sendPush(to.profile_id, {
    title:
      news === "going" ? t("{name} is going", { name })
      : news === "cant" ? `⚠️ ${t("{name} can't make it", { name })}`
      : t("{name} gave you something to do", { name }),
    body: `${label} · ${when}`,
    url: kid ? "/kids" : "/calendar",
    tag: `${news === "going" || news === "cant" ? "care" : "assign"}-${member_id}-${starts_at}`,
  });
  return Response.json({ sent });
}
