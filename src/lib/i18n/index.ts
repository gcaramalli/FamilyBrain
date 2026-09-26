// Tiny i18n: English text is the key; other languages map it to a
// translation (missing entries fall back to English). "{name}" placeholders
// are filled from `vars`.
import { fr } from "./fr";
import { sv } from "./sv";

export type Locale = "en" | "fr" | "sv";

export const LOCALES: { id: Locale; label: string }[] = [
  { id: "en", label: "English" },
  { id: "fr", label: "Français" },
  { id: "sv", label: "Svenska" },
];

// Dates in English use British order and a 24-hour clock.
export const BCP47: Record<Locale, string> = { en: "en-GB", fr: "fr-FR", sv: "sv-SE" };

const dicts: Record<Locale, Record<string, string>> = { en: {}, fr, sv };

export type Vars = Record<string, string | number>;
export type T = (key: string, vars?: Vars) => string;

export function translator(locale: Locale): T {
  const dict = dicts[locale] ?? {};
  return (key, vars) => {
    const s = dict[key] ?? key;
    return vars ? s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`)) : s;
  };
}

export const isLocale = (x: unknown): x is Locale => x === "en" || x === "fr" || x === "sv";
