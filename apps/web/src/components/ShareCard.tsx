import type { SummaryDto } from "../api/types";

interface Props {
  summary: SummaryDto;
}

export function ShareCard({ summary }: Props) {
  const { userClub, userRow, position, unbeaten, shareText } = summary;

  async function copyToClipboard() {
    if (shareText) await navigator.clipboard.writeText(shareText);
  }

  if (!userClub || !userRow) return null;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-8 text-center shadow-2xl ${
        unbeaten
          ? "border-amber-400/60 bg-gradient-to-br from-amber-500/20 via-slate-900 to-slate-950"
          : "border-slate-800 bg-gradient-to-br from-emerald-500/10 via-slate-900 to-slate-950"
      }`}
    >
      {unbeaten && (
        <div className="absolute right-4 top-4 rounded-full bg-amber-400 px-3 py-1 text-xs font-black uppercase tracking-wider text-slate-950">
          Unbeaten
        </div>
      )}
      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Season Result</p>
      <h2 className="mt-2 text-3xl font-black tracking-tight text-white">{userClub.name}</h2>
      <p className="mt-1 text-sm text-slate-400">Finished {position ? `#${position}` : "—"} in the table</p>

      <div className="mx-auto mt-6 grid max-w-xs grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-2xl font-black text-emerald-400">{userRow.won}</div>
          <div className="text-xs uppercase text-slate-500">Won</div>
        </div>
        <div>
          <div className="text-2xl font-black text-slate-300">{userRow.drawn}</div>
          <div className="text-xs uppercase text-slate-500">Drawn</div>
        </div>
        <div>
          <div className="text-2xl font-black text-rose-400">{userRow.lost}</div>
          <div className="text-xs uppercase text-slate-500">Lost</div>
        </div>
      </div>

      <p className="mt-6 text-lg font-bold text-white">
        {userRow.goalsFor}-{userRow.goalsAgainst}{" "}
        <span className="text-sm font-normal text-slate-400">goals for/against</span>
      </p>

      <button
        onClick={copyToClipboard}
        className="mt-8 rounded-md bg-white px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
      >
        Copy result to share
      </button>
    </div>
  );
}
