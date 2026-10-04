/** Emoji flags for nationalities as the catalog stores them (Transfermarkt country names). Emoji
    flags are free and need no assets; anything unmapped falls back to the caller's monogram. */

/** Home nations: subdivision-tag emoji render as a plain black flag on Windows, so they get no
    emoji here (the directory shows its monogram tile); England itself has an SVG in CountryFlag. */
const SUBDIVISION: Record<string, string> = {};

const ISO2: Record<string, string> = {
  Albania: "AL", Algeria: "DZ", Angola: "AO", Argentina: "AR", Armenia: "AM", Australia: "AU", Austria: "AT",
  Belgium: "BE", Benin: "BJ", Bolivia: "BO", "Bosnia-Herzegovina": "BA", Brazil: "BR", Bulgaria: "BG",
  "Burkina Faso": "BF", Burundi: "BI", Cameroon: "CM", Canada: "CA", "Cape Verde": "CV", "Central African Republic": "CF",
  Chad: "TD", Chile: "CL", China: "CN", Colombia: "CO", Comoros: "KM", Congo: "CG", "Costa Rica": "CR",
  "Cote d'Ivoire": "CI", Croatia: "HR", Curacao: "CW", Cyprus: "CY", "Czech Republic": "CZ", Denmark: "DK",
  "DR Congo": "CD", Ecuador: "EC", Egypt: "EG", "Equatorial Guinea": "GQ", Estonia: "EE", Finland: "FI",
  France: "FR", Gabon: "GA", Gambia: "GM", "The Gambia": "GM", Georgia: "GE", Germany: "DE", Ghana: "GH",
  Greece: "GR", Guadeloupe: "GP", Guinea: "GN", "Guinea-Bissau": "GW", Haiti: "HT", Honduras: "HN",
  Hungary: "HU", Iceland: "IS", Iran: "IR", Iraq: "IQ", Ireland: "IE", Israel: "IL", Italy: "IT",
  Jamaica: "JM", Japan: "JP", Kenya: "KE", Kosovo: "XK", "Korea, South": "KR", Latvia: "LV", Lithuania: "LT",
  Luxembourg: "LU", Madagascar: "MG", Mali: "ML", Malta: "MT", Martinique: "MQ", Mauritania: "MR", Mexico: "MX",
  Moldova: "MD", Montenegro: "ME", Morocco: "MA", Mozambique: "MZ", Netherlands: "NL", "New Zealand": "NZ",
  Niger: "NE", Nigeria: "NG", "North Macedonia": "MK", Norway: "NO", Panama: "PA", Paraguay: "PY", Peru: "PE",
  Philippines: "PH", Poland: "PL", Portugal: "PT", Romania: "RO", Russia: "RU", Rwanda: "RW", "Saudi Arabia": "SA",
  Senegal: "SN", Serbia: "RS", "Sierra Leone": "SL", Slovakia: "SK", Slovenia: "SI", "South Africa": "ZA",
  Spain: "ES", Suriname: "SR", Sweden: "SE", Switzerland: "CH", Syria: "SY", Tanzania: "TZ", Togo: "TG",
  Tunisia: "TN", Turkey: "TR", Türkiye: "TR", Uganda: "UG", Ukraine: "UA", "United States": "US", Uruguay: "UY",
  Uzbekistan: "UZ", Venezuela: "VE", Zambia: "ZM", Zimbabwe: "ZW",
};

export function nationFlag(nationality: string): string {
  const sub = SUBDIVISION[nationality];
  if (sub) return sub;
  const code = ISO2[nationality];
  if (!code) return "";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

let flagSupport: boolean | undefined;

/** Whether this platform draws flag emoji in colour (Windows shows letter pairs instead). Checked
    once by drawing one onto a canvas and looking for coloured pixels; false where canvas is missing. */
export function supportsFlagEmoji(): boolean {
  if (flagSupport !== undefined) return flagSupport;
  flagSupport = false;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 24;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return flagSupport;
    ctx.font = "20px sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText("🇫🇷", 0, 0);
    const data = ctx.getImageData(0, 0, 24, 24).data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3]! > 0 && (Math.abs(data[i]! - data[i + 1]!) > 30 || Math.abs(data[i + 1]! - data[i + 2]!) > 30)) {
        flagSupport = true;
        break;
      }
    }
  } catch {
    flagSupport = false;
  }
  return flagSupport;
}
