/** Inline SVG flags for the five league countries. Emoji flags don't render on Windows (they show as
    letter pairs, and England's subdivision flag as a black flag), and these five are on every Setup
    and directory screen, so they're drawn rather than left to the platform's emoji font. */

const FLAGS: Record<string, JSX.Element> = {
  England: (
    <>
      <rect width="30" height="20" fill="#fff" />
      <rect x="12.5" width="5" height="20" fill="#ce1124" />
      <rect y="7.5" width="30" height="5" fill="#ce1124" />
    </>
  ),
  Spain: (
    <>
      <rect width="30" height="20" fill="#aa151b" />
      <rect y="5" width="30" height="10" fill="#f1bf00" />
    </>
  ),
  Italy: (
    <>
      <rect width="10" height="20" fill="#009246" />
      <rect x="10" width="10" height="20" fill="#fff" />
      <rect x="20" width="10" height="20" fill="#ce2b37" />
    </>
  ),
  Germany: (
    <>
      <rect width="30" height="6.67" fill="#000" />
      <rect y="6.67" width="30" height="6.67" fill="#dd0000" />
      <rect y="13.33" width="30" height="6.67" fill="#ffce00" />
    </>
  ),
  France: (
    <>
      <rect width="10" height="20" fill="#0055a4" />
      <rect x="10" width="10" height="20" fill="#fff" />
      <rect x="20" width="10" height="20" fill="#ef4135" />
    </>
  ),
};

export function hasCountryFlag(country: string | undefined): boolean {
  return Boolean(country && FLAGS[country]);
}

export function CountryFlag({ country, className = "h-3 w-[18px]" }: { country: string | undefined; className?: string }) {
  const flag = country ? FLAGS[country] : undefined;
  if (!flag) return null;
  return (
    <svg viewBox="0 0 30 20" className={`inline-block shrink-0 rounded-[2px] ${className}`} aria-hidden>
      {flag}
    </svg>
  );
}
