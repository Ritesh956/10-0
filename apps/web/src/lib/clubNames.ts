/**
 * Everyday names for real clubs. The catalog stores legal names from the source data ("1. Fußballclub
 * Heidenheim 1846", "Associazione Sportiva Roma", "Bologna Football Club 1909"), which read oddly in
 * a table or on a tile. Display only — ids and stored names are untouched.
 */

/** Names that the generic rules below would get wrong or leave clumsy. */
const OVERRIDES: Record<string, string> = {
  "1. Fußballclub Heidenheim 1846": "Heidenheim",
  "Associazione Sportiva Roma": "Roma",
  "Società Sportiva Lazio": "Lazio",
  "Real Betis Balompié": "Real Betis",
  "Wolverhampton Wanderers": "Wolves",
  "Brighton & Hove Albion": "Brighton",
  "Tottenham Hotspur": "Tottenham",
  "Bayer 04 Leverkusen": "Leverkusen",
  "TSG 1899 Hoffenheim": "Hoffenheim",
  "RCD Espanyol Barcelona": "Espanyol",
  "RC Strasbourg Alsace": "Strasbourg",
  "Stade Rennais FC": "Rennes",
  "Stade Brestois 29": "Brest",
  "Olympique Lyon": "Lyon",
  "Olympique Marseille": "Marseille",
  "Celta de Vigo": "Celta Vigo",
  "Deportivo Alavés": "Alavés",
  "Paris Saint-Germain": "Paris SG",
  "Paris Saint-Germain Football Club": "Paris SG",
  "Borussia Mönchengladbach": "Gladbach",
};

/** Leading legal-form tokens ("FC Barcelona", "SSC Napoli", "1.FC Union Berlin"). "AC" is left alone
    on purpose: "AC Milan" is the everyday name. */
const PREFIX = /^(?:1\.\s?(?:FC|FSV)|FC|AFC|SSC|US|ACF|RCD|RC|CA|UD|CD|SD|SV|SC|VfL|LOSC|OGC|AJ|AS)\s+/;
/** Trailing legal-form tokens and founding years ("Liverpool FC", "Udinese Calcio", "Mainz 05"). */
const SUFFIX = /\s+(?:FC|F\.C\.|CF|AFC|CFC|BC|HSC|SCO|AC|Calcio|\d{2,4})$/;

export function clubDisplayName(name: string): string {
  const override = OVERRIDES[name];
  if (override) return override;
  let out = name.replace(/\s*Football Club(?:\s+\d{4})?/g, "").trim();
  out = out.replace(PREFIX, "");
  for (let i = 0; i < 3 && SUFFIX.test(out); i++) out = out.replace(SUFFIX, "");
  return out.trim() || name;
}

/** A world club's label: real (AI) clubs get their everyday name; a user-named club is shown as typed. */
export function worldClubLabel(club: { name: string; managedByUserId?: string | null } | undefined, fallback: string): string {
  if (!club) return fallback;
  return club.managedByUserId ? club.name : clubDisplayName(club.name);
}
