// Evening reminder, run daily by Vercel Cron (vercel.json): tells each parent
// what they do tomorrow, and flags drop-offs/pick-ups nobody has taken.
//
// Date maths below uses the process time zone, so pin it to the family's.
process.env.TZ = "Europe/Stockholm";

import { CARE_KINDS, careTitle, findSlot, isCareDay } from "@/lib/care";
import { addDays, dayKey, startOfDay } from "@/lib/dates";
import { fetchOccurrences } from "@/lib/events";
import { isLocale, translator } from "@/lib/i18n";
import { pushEnabled, sendPush } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EventOccurrence, Member } from "@/lib/types";

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("unauthorized", { status: 401 });
  if (!pushEnabled()) return Response.json({ skipped: "push not configured" });

  const db = createAdminClient();
  const tomorrow = addDays(startOfDay(new Date()), 1);
  const key = dayKey(tomorrow);
  const { data: families } = await db.from("families").select("id");
  let sent = 0;

  for (const { id: familyId } of families ?? []) {
    const [{ data: members }, { data: profiles }, events] = await Promise.all([
      db.from("members").select("*").eq("family_id", familyId),
      db.from("profiles").select("id, locale").eq("family_id", familyId),
      fetchOccurrences(db, tomorrow, addDays(tomorrow, 1), familyId),
    ]);
    const people = (members ?? []) as Member[];
    const kids = people.filter((m) => !m.profile_id);
    const adults = people.filter((m) => m.profile_id);

    for (const adult of adults) {
      const profile = (profiles ?? []).find((p) => p.id === adult.profile_id);
      const t = translator(isLocale(profile?.locale) ? profile.locale : "en");
      const label = (e: EventOccurrence) => {
        const kid = kids.find((k) => k.id === e.for_member_id);
        if (kid && e.care && e.title === careTitle(e.care, kid)) {
          return e.care === "dropoff" ? t("Drop-off {name}", { name: kid.name }) : t("Pick-up {name}", { name: kid.name });
        }
        return e.title;
      };

      const mine = events
        .filter((e) => e.responsible_member_id === adult.id && dayKey(e.occurrence_start) === key)
        .map((e) => `${e.all_day ? "" : `${hhmm(e.occurrence_start)} `}${label(e)}`);
      const nobody: string[] = [];
      for (const kid of kids) {
        if (!isCareDay(kid, tomorrow)) continue;
        for (const kind of CARE_KINDS) {
          if (!findSlot(events, kid, key, kind)?.responsible_member_id) {
            nobody.push(kind === "dropoff" ? t("Nobody takes {name} in the morning yet", { name: kid.name }) : t("Nobody picks up {name} yet", { name: kid.name }));
          }
        }
      }
      if (!mine.length && !nobody.length) continue;

      sent += await sendPush(adult.profile_id!, {
        title: nobody.length ? `⚠️ ${t("Tomorrow")}` : t("Tomorrow"),
        body: [...mine, ...nobody].join("\n"),
        url: nobody.length ? "/kids" : "/",
        tag: `evening-${key}`,
      });
    }
  }
  return Response.json({ sent });
}
