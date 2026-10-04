import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { detectLang, rememberLang, translate, translateOr, type Lang, type MessageKey } from "./index";

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  /** A translation for a dynamic key (e.g. "trophy.<key>") when one exists, else `fallback`. */
  tOr: (key: string, fallback: string) => string;
}

// Without a provider (unit tests, isolated renders) everything reads as English.
const DEFAULT: I18nValue = {
  lang: "en",
  setLang: () => {},
  t: (key, vars) => translate("en", key, vars),
  tOr: (_key, fallback) => fallback,
};

const I18nContext = createContext<I18nValue>(DEFAULT);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => detectLang());

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    rememberLang(next);
    setLangState(next);
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      setLang,
      t: (key, vars) => translate(lang, key, vars),
      tOr: (key, fallback) => translateOr(lang, key, fallback),
    }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): I18nValue {
  return useContext(I18nContext);
}
