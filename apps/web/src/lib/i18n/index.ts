import { de } from "./messages.de";
import { en, type MessageKey } from "./messages.en";
import { es } from "./messages.es";
import { fr } from "./messages.fr";
import { it } from "./messages.it";

export type { MessageKey } from "./messages.en";

export type Lang = "en" | "es" | "it" | "de" | "fr";

export const LANGUAGES: { code: Lang; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "es", label: "Spanish", native: "Español" },
  { code: "it", label: "Italian", native: "Italiano" },
  { code: "de", label: "German", native: "Deutsch" },
  { code: "fr", label: "French", native: "Français" },
];

const DICTIONARIES: Record<Lang, Partial<Record<MessageKey, string>>> = { en, es, it, de, fr };

const STORAGE_KEY = "futbol_lang";

export function isLang(value: unknown): value is Lang {
  return LANGUAGES.some((l) => l.code === value);
}

/** "es-MX" → "es"; anything unsupported → undefined. */
export function langFromLocale(locale: string | undefined | null): Lang | undefined {
  const base = (locale ?? "").toLowerCase().split(/[-_]/)[0];
  return isLang(base) ? base : undefined;
}

/** The stored choice, else the browser's language if we speak it, else English. */
export function detectLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLang(stored)) return stored;
  } catch {
    // Storage blocked — fall through to the browser language.
  }
  const fromBrowser = typeof navigator !== "undefined" ? langFromLocale(navigator.language) : undefined;
  return fromBrowser ?? "en";
}

export function rememberLang(lang: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // The choice just won't survive a reload.
  }
}

/** The message in `lang`, falling back to English (never blank), with `{name}` placeholders filled. */
export function translate(lang: Lang, key: MessageKey, vars?: Record<string, string | number>): string {
  const template = DICTIONARIES[lang][key] ?? en[key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

/** A translation if this language has one for `key`, else `fallback` (used for trophy names, whose
    English source of truth is lib/trophies.ts rather than the message file). */
export function translateOr(lang: Lang, key: string, fallback: string): string {
  if (lang === "en") return fallback;
  return (DICTIONARIES[lang] as Record<string, string | undefined>)[key] ?? fallback;
}
