import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { isLocale, LOCALES, translator, type Locale } from "@/lib/i18n";

// Public landing page: what Hembrain is and how to start a family.
// Signed-out visitors to "/" land here (see src/proxy.ts). There is no
// profile yet, so the language comes from ?lang= or the browser.

const TITLE = "Hembrain — the family brain";

export const metadata: Metadata = {
  title: TITLE,
  description: "A shared calendar, lists, recipes and notes for your household. Create your family in a minute.",
};

async function pickLocale(lang: string | string[] | undefined): Promise<Locale> {
  if (isLocale(lang)) return lang;
  const accept = (await headers()).get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (isLocale(code)) return code;
  }
  return "en";
}

const FEATURES = [
  { icon: "📅", title: "Shared calendar", body: "Who drops off, who picks up, appointments and trips. Each person has their colour, so you see at a glance who does what." },
  { icon: "🧸", title: "Kids", body: "Usual drop-off and pick-up times, and a heads-up when nobody is down for one yet." },
  { icon: "🛒", title: "Lists", body: "Shopping sorted by aisle and to-dos. It learns what you buy and tells you what is probably running out." },
  { icon: "🍝", title: "Recipes", body: "Your family recipes, favourites first, with dinner ideas when nobody knows what to cook." },
  { icon: "🧠", title: "The family brain", body: "Pickup rules, addresses, allergies, door codes: everything you need to remember, in one place." },
  { icon: "✨", title: "Works with Claude", body: "Connect Claude and just say “Alex picks up Sam on Thursday at 4” or send a photo of a receipt." },
];

const STEPS = [
  { title: "Create your family", body: "Choose a family name, then enter your first name, email and a password. You become the family's admin." },
  { title: "Confirm and sign in", body: "If we send you a confirmation email, open the link, then sign in." },
  { title: "Add your people", body: "In the Admin tab, add the children (they don't need an account) and invite your partner with a personal link." },
  { title: "Make it yours", body: "Add Hembrain to your phone's home screen (Share → Add to Home Screen) and, if you like, connect Claude from the Me tab." },
];

export default async function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  const { lang } = await searchParams;
  const locale = await pickLocale(lang);
  const t = translator(locale);

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-12 px-4 py-10 sm:px-6">
      <nav className="flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold">🏡 Hembrain</span>
        <div className="flex items-center gap-3 text-muted">
          {LOCALES.map((l) => (
            <Link key={l.id} href={`/welcome?lang=${l.id}`} className={l.id === locale ? "text-foreground underline" : ""} hrefLang={l.id}>
              {l.id.toUpperCase()}
            </Link>
          ))}
          <Link href="/login" className="text-foreground">{t("Sign in")}</Link>
        </div>
      </nav>

      <header className="flex flex-col gap-4">
        <div className="text-5xl">🏡</div>
        <h1 className="text-4xl leading-tight font-semibold tracking-tight text-balance">{t("The family brain")}</h1>
        <p className="text-lg text-muted text-pretty">
          {t("A shared calendar, lists, recipes and notes for your household, so nobody has to keep it all in their head.")}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/signup" className="btn">{t("Create your family")}</Link>
          <Link href="/login" className="btn-ghost">{t("I already have an account")}</Link>
        </div>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="h2">{t("What's inside")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="card flex flex-col gap-1">
              <div className="text-2xl">{f.icon}</div>
              <h3 className="font-medium">{t(f.title)}</h3>
              <p className="text-sm text-muted">{t(f.body)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="h2">{t("Get started in a few minutes")}</h2>
        <ol className="flex flex-col gap-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-on-accent">{i + 1}</span>
              <div>
                <h3 className="font-medium">{t(s.title)}</h3>
                <p className="text-sm text-muted">{t(s.body)}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="rounded-2xl bg-accent-soft p-4 text-sm">
          <b>{t("Invited by someone?")}</b>{" "}
          {t("Use the link they sent you instead: it adds you to their family rather than creating a new one.")}
        </p>
        <Link href="/signup" className="btn self-start">{t("Create your family")}</Link>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="h2">{t("Private by design")}</h2>
        <p className="text-muted">
          {t("Each family only ever sees its own calendar, lists and notes. Children appear in the family without needing an account.")}
        </p>
      </section>

      <footer className="border-t border-border pt-6 text-sm text-muted">
        Hembrain · <Link href="/login">{t("Sign in")}</Link> · <Link href="/signup">{t("Create your family")}</Link>
      </footer>
    </main>
  );
}
