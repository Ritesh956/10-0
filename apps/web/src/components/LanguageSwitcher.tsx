import { isLang, LANGUAGES } from "../lib/i18n";
import { useT } from "../lib/i18n/context";

/** A compact language picker (English, Español, Italiano, Deutsch, Français). The choice is
    remembered and the first visit follows the browser's language. */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { lang, setLang, t } = useT();
  return (
    <label className={`inline-flex items-center ${className}`}>
      <span className="sr-only">{t("nav.language")}</span>
      <select
        value={lang}
        onChange={(e) => isLang(e.target.value) && setLang(e.target.value)}
        className="rounded-md border border-ink-800 bg-ink-900 px-1.5 py-1 text-xs font-semibold uppercase text-smoke-300 outline-none transition hover:border-ink-600 focus:border-mint-500"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.native}
          </option>
        ))}
      </select>
    </label>
  );
}
