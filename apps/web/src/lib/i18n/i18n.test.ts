import { afterEach, describe, expect, it } from "vitest";
import { detectLang, langFromLocale, LANGUAGES, rememberLang, translate, translateOr } from "./index";
import { de } from "./messages.de";
import { en, type MessageKey } from "./messages.en";
import { es } from "./messages.es";
import { fr } from "./messages.fr";
import { it as itMessages } from "./messages.it";

afterEach(() => localStorage.clear());

describe("translate", () => {
  it("returns the language's message, and English when it's missing", () => {
    expect(translate("es", "nav.play")).toBe("Jugar");
    expect(translate("de", "nav.play")).toBe("Spielen");
    expect(translate("en", "nav.play")).toBe("Play");
    // A key a (hypothetical) language lacks falls back instead of rendering blank.
    expect(translate("fr", "nav.play")).toBe("Jouer");
  });

  it("fills {placeholders} and leaves unknown ones alone", () => {
    expect(translate("it", "landing.continue", { n: 7 })).toBe("Continua il tuo draft (7/11)");
    expect(translate("en", "season.clubSeason", { club: "Arsenal" })).toBe("Arsenal's season");
    expect(translate("en", "season.clubSeason")).toBe("{club}'s season");
  });

  it("translateOr uses a dynamic translation, else the fallback", () => {
    expect(translateOr("es", "trophy.champions", "Champions")).toBe("Campeones");
    expect(translateOr("es", "trophy.no-such-trophy", "Whatever")).toBe("Whatever");
    expect(translateOr("en", "trophy.champions", "Champions")).toBe("Champions");
  });
});

describe("every translation is complete and well-formed", () => {
  const keys = Object.keys(en) as MessageKey[];
  const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");

  for (const [name, dict] of [
    ["es", es],
    ["it", itMessages],
    ["de", de],
    ["fr", fr],
  ] as const) {
    it(`${name} covers every English key and keeps its placeholders`, () => {
      const missing = keys.filter((k) => dict[k] === undefined);
      expect(missing).toEqual([]);
      for (const key of keys) expect(placeholders(dict[key]!)).toBe(placeholders(en[key]));
    });

    it(`${name} has no extra keys`, () => {
      expect(Object.keys(dict).filter((k) => !(k in en))).toEqual([]);
    });
  }
});

describe("language choice", () => {
  it("maps locales to a supported language", () => {
    expect(langFromLocale("es-MX")).toBe("es");
    expect(langFromLocale("de_AT")).toBe("de");
    expect(langFromLocale("pt-BR")).toBeUndefined();
    expect(langFromLocale(undefined)).toBeUndefined();
  });

  it("prefers the stored choice, and lists exactly five languages", () => {
    rememberLang("fr");
    expect(detectLang()).toBe("fr");
    expect(LANGUAGES.map((l) => l.code)).toEqual(["en", "es", "it", "de", "fr"]);
  });

  it("ignores a stored value it doesn't know", () => {
    localStorage.setItem("futbol_lang", "klingon");
    expect(detectLang()).toBe("en"); // jsdom's navigator.language is en-US
  });
});
