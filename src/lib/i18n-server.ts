import "server-only";

import { cookies } from "next/headers";

import { translations, type Language } from "@/lib/translations";

export const LANG_COOKIE = "synapse-lang";

// Catalan is the product default (matches <html lang> and the memoir):
// the language switcher persists the choice to a cookie so server
// components can render in the same language as the client UI without a
// hydration mismatch.
const DEFAULT_LANGUAGE: Language = "ca";

function normalise(value: string | undefined): Language {
  return value === "en" || value === "es" || value === "ca"
    ? value
    : DEFAULT_LANGUAGE;
}

// Reads the active language from the cookie. Server components await this.
export async function getLanguage(): Promise<Language> {
  const store = await cookies();
  return normalise(store.get(LANG_COOKIE)?.value);
}

// Server-side translations object, mirror of the client `t` from
// useLanguage(). Usage: `const t = await getServerT();`
export async function getServerT() {
  return translations[await getLanguage()];
}
