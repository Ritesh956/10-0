import { worldClubLabel } from "../lib/clubNames";
import { motion } from "framer-motion";
import type { StandingsDto, WorldClubDto } from "../api/types";
import type { TableZone } from "../lib/europe";
import { staggerContainer, staggerItem } from "../lib/motion";
import { CountryFlag } from "./CountryFlag";
import { useT } from "../lib/i18n/context";

interface Props {
  standings: StandingsDto;
  clubs: WorldClubDto[];
  highlightClubId?: string | undefined;
  /** Colour a row's left edge by its 1-based position (e.g. a qualification zone); pair with `legend`. */
  zoneFor?: ((position: number) => TableZone | undefined) | undefined;
  /** Zones shown under the table. */
  legend?: TableZone[] | undefined;
  /** A league flag beside each club — for tables that mix clubs from several leagues. */
  showFlags?: boolean | undefined;
}

export function StandingsTable({ standings, clubs, highlightClubId, zoneFor, legend, showFlags }: Props) {
  const { t } = useT();
  const nameFor = (clubId: string) => worldClubLabel(clubs.find((c) => c.id === clubId), clubId);
  const countryFor = (clubId: string) => clubs.find((c) => c.id === clubId)?.country ?? undefined;

  return (
    <div className="space-y-2">
    <div className="notch overflow-x-auto border border-ink-800">
      <table className="w-full text-sm">
        <thead className="bg-ink-900 text-left font-display text-xs uppercase tracking-widest text-smoke-600">
          <tr>
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">{t("table.club")}</th>
            <th className="px-3 py-2 text-center">{t("table.p")}</th>
            <th className="px-3 py-2 text-center">{t("table.w")}</th>
            <th className="px-3 py-2 text-center">{t("table.d")}</th>
            <th className="px-3 py-2 text-center">{t("table.l")}</th>
            <th className="px-3 py-2 text-center">{t("table.gf")}</th>
            <th className="px-3 py-2 text-center">{t("table.ga")}</th>
            <th className="px-3 py-2 text-center">{t("table.gd")}</th>
            <th className="px-3 py-2 text-center font-bold">{t("table.pts")}</th>
          </tr>
        </thead>
        <motion.tbody
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          transition={{ staggerChildren: 0.03 }}
          className="divide-y divide-ink-800"
        >
          {standings.rows.map((row, i) => {
            const gd = row.goalsFor - row.goalsAgainst;
            const zone = zoneFor?.(i + 1);
            return (
              <motion.tr
                key={row.clubId}
                variants={staggerItem}
                className={row.clubId === highlightClubId ? "bg-mint-500/10" : i % 2 === 0 ? "bg-ink-950" : "bg-ink-900/40"}
              >
                <td className={`px-3 py-2 text-smoke-600 ${zone ? `border-l-4 ${zone.border}` : ""}`}>{i + 1}</td>
                <td className="px-3 py-2 font-medium text-paper">
                  {showFlags && <CountryFlag country={countryFor(row.clubId)} className="mr-1.5 h-3 w-[18px] align-[-1px]" />}
                  {nameFor(row.clubId)}
                  {row.clubId === highlightClubId && <span className="ml-1.5 text-xs font-normal text-mint-400">(You)</span>}
                </td>
                <td className="px-3 py-2 text-center text-smoke-400">{row.played}</td>
                <td className="px-3 py-2 text-center font-semibold text-teal-400">{row.won}</td>
                <td className="px-3 py-2 text-center text-smoke-400">{row.drawn}</td>
                <td className="px-3 py-2 text-center font-semibold text-crimson-400">{row.lost}</td>
                <td className="px-3 py-2 text-center text-smoke-400">{row.goalsFor}</td>
                <td className="px-3 py-2 text-center text-smoke-400">{row.goalsAgainst}</td>
                <td
                  className={`px-3 py-2 text-center font-medium ${
                    gd > 0 ? "text-teal-400" : gd < 0 ? "text-crimson-400" : "text-smoke-400"
                  }`}
                >
                  {gd > 0 ? `+${gd}` : gd}
                </td>
                <td className="px-3 py-2 text-center font-bold text-mint-400">{row.points}</td>
              </motion.tr>
            );
          })}
        </motion.tbody>
      </table>
    </div>
    {legend && legend.length > 0 && (
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-smoke-500">
        {legend.map((zone) => (
          <li key={zone.label} className="flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full ${zone.dot}`} />
            {zone.label}
          </li>
        ))}
      </ul>
    )}
    </div>
  );
}
