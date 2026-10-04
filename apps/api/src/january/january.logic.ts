/** Pure decision logic for resolving a January Transfer Window gamble — factored out of
    january.service.ts (which is Prisma-coupled) so the weighting, weakest-slot detection, and
    candidate-biasing rules are unit-testable without mocking the database, matching the pattern
    already used by lineup.ts/round-robin.ts/build-squad.ts. */

export type JanuaryEventType = "POSITIVE" | "NEUTRAL" | "NEGATIVE";

/** Weighted so a gamble is more often a wash or an upgrade than a genuine downgrade, while still
    keeping the "can help or hurt" flavor 38-0's setup copy promises. */
export const EVENT_WEIGHTS: { type: JanuaryEventType; weight: number }[] = [
  { type: "POSITIVE", weight: 35 },
  { type: "NEUTRAL", weight: 40 },
  { type: "NEGATIVE", weight: 25 },
];

export function totalEventWeight(): number {
  return EVENT_WEIGHTS.reduce((sum, w) => sum + w.weight, 0);
}

/** Maps a roll in [0, totalEventWeight()) to an event type — pure so the weighting can be
    unit-tested without going through crypto.randomInt. */
export function pickEventType(roll: number): JanuaryEventType {
  let remaining = roll;
  for (const w of EVENT_WEIGHTS) {
    if (remaining < w.weight) return w.type;
    remaining -= w.weight;
  }
  return "NEUTRAL";
}

export interface LineupSlotJson {
  position: string;
  playerId: string;
}

export interface OverallLookup {
  overall: number;
}

/** The weakest-rated occupied lineup slot — the one January strengthens. Ties resolve to
    whichever slot appears first in `lineup`. */
export function findWeakestSlot<T extends OverallLookup>(
  lineup: LineupSlotJson[],
  playerById: Map<string, T>,
): { slot: LineupSlotJson; player: T } | undefined {
  let weakestSlot: LineupSlotJson | undefined;
  let weakestPlayer: T | undefined;
  for (const slot of lineup) {
    const player = playerById.get(slot.playerId);
    if (!player) continue;
    if (!weakestPlayer || player.overall < weakestPlayer.overall) {
      weakestSlot = slot;
      weakestPlayer = player;
    }
  }
  return weakestSlot && weakestPlayer ? { slot: weakestSlot, player: weakestPlayer } : undefined;
}

/** Narrows a candidate pool to upgrades (POSITIVE) or downgrades (NEGATIVE) relative to the
    outgoing player's overall, falling back to the full pool when the biased slice is empty (e.g.
    nobody stronger exists at that position/era) so a draw is always possible. NEUTRAL never
    narrows. */
export function biasPoolForEvent<T extends OverallLookup>(
  pool: T[],
  eventType: JanuaryEventType,
  outgoingOverall: number,
): T[] {
  const biased =
    eventType === "POSITIVE"
      ? pool.filter((p) => p.overall > outgoingOverall)
      : eventType === "NEGATIVE"
        ? pool.filter((p) => p.overall < outgoingOverall)
        : pool;
  return biased.length > 0 ? biased : pool;
}

// --- Event kinds (the 38-0-style "event layer") ---------------------------------------------------

/** The named January events. Each changes *which* slot is touched and *how* the replacement is
    found, so the window is a different decision each season rather than one coin flip. */
export type JanuaryEventKind =
  | "bargain-buy"
  | "wheeler-dealer"
  | "deadline-day"
  | "loan-swap"
  | "star-wants-out"
  | "border-raid";

export interface JanuaryKindSpec {
  kind: JanuaryEventKind;
  label: string;
  premise: string;
  weight: number;
  /** Which lineup slot the event acts on. */
  target: "weakest" | "random" | "strongest";
  /** How the replacement pool is narrowed relative to the outgoing player. */
  bias: JanuaryEventType;
  /** Draw from one specific league other than the club's own — chosen per window (see
      `pickForeignLeague`) and named in the event ("Bundesliga Bargain", "Serie A Loan Swap"). */
  otherLeagues?: boolean;
  /** Offer this many blind options to choose from instead of a single draw. */
  options?: number;
}

export const JANUARY_KINDS: JanuaryKindSpec[] = [
  { kind: "bargain-buy", label: "Bargain Buy", premise: "A club in trouble will sell cheap. Your weakest starter makes way for a better player.", weight: 20, target: "weakest", bias: "POSITIVE" },
  { kind: "wheeler-dealer", label: "Wheeler Dealer", premise: "Three agents, three blind offers for your weakest slot. Pick one; you see the rating after you sign.", weight: 20, target: "weakest", bias: "NEUTRAL", options: 3 },
  { kind: "deadline-day", label: "Deadline Day Panic", premise: "The window's closing and the phones are ringing. Someone in your XI is going; nobody knows who comes in.", weight: 15, target: "random", bias: "NEUTRAL" },
  { kind: "loan-swap", label: "Loan Swap", premise: "A loan from the {league} for your weakest slot. Could be a gem, could be a passenger.", weight: 15, target: "weakest", bias: "NEUTRAL", otherLeagues: true },
  { kind: "star-wants-out", label: "Star Wants Out", premise: "Your best player has handed in a transfer request. You'll get a replacement, but rarely a like-for-like.", weight: 15, target: "strongest", bias: "NEGATIVE" },
  { kind: "border-raid", label: "Bargain", premise: "A {league} side needs the cash. Your weakest starter makes way for a better player from across the border.", weight: 15, target: "weakest", bias: "POSITIVE", otherLeagues: true },
];

/** The league a cross-border event reaches into: one of the other leagues, picked from the seed so
    the same window always names the same league. */
export function pickForeignLeague<T extends { id: string }>(leagues: T[], homeLeagueId: string | undefined, random: () => number): T | undefined {
  const others = leagues.filter((l) => l.id !== homeLeagueId).sort((a, b) => a.id.localeCompare(b.id));
  return others.length > 0 ? others[Math.floor(random() * others.length)] : undefined;
}

/** "Bundesliga" + "Bargain" → "Bundesliga Bargain"; plain events keep their own label. */
export function eventLabel(spec: JanuaryKindSpec, foreignLeagueName?: string): string {
  return spec.otherLeagues && foreignLeagueName ? `${foreignLeagueName} ${spec.label}` : spec.label;
}

export function eventPremise(spec: JanuaryKindSpec, foreignLeagueName?: string): string {
  return spec.premise.replace("{league}", foreignLeagueName ?? "other leagues");
}

/** Small deterministic string → [0,1) generator (FNV-1a seeded mulberry32). The January offer is a
    pure function of (season, club), so asking for it twice returns the same event and the same
    options — refreshing the page can't re-roll a bad window, and nothing needs storing until the
    deal is done. */
export function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickKind(random: () => number): JanuaryKindSpec {
  const total = JANUARY_KINDS.reduce((s, k) => s + k.weight, 0);
  let roll = random() * total;
  for (const k of JANUARY_KINDS) {
    if (roll < k.weight) return k;
    roll -= k.weight;
  }
  return JANUARY_KINDS[0]!;
}

/** The lineup slot an event acts on. Ties resolve to the first slot in lineup order. */
export function pickTargetSlot<T extends OverallLookup>(
  lineup: LineupSlotJson[],
  playerById: Map<string, T>,
  target: JanuaryKindSpec["target"],
  random: () => number,
): { slot: LineupSlotJson; player: T } | undefined {
  const occupied = lineup.flatMap((slot) => {
    const player = playerById.get(slot.playerId);
    return player ? [{ slot, player }] : [];
  });
  if (occupied.length === 0) return undefined;
  if (target === "random") return occupied[Math.floor(random() * occupied.length)];
  return occupied.reduce((best, cur) =>
    target === "weakest" ? (cur.player.overall < best.player.overall ? cur : best) : cur.player.overall > best.player.overall ? cur : best,
  );
}

/** Like biasPoolForEvent, but a "star wants out" downgrade stays within 8 points when it can — a
    sale should sting, not gut the side. */
export function biasPoolForKind<T extends OverallLookup>(pool: T[], spec: JanuaryKindSpec, outgoingOverall: number): T[] {
  if (spec.bias === "NEGATIVE") {
    const near = pool.filter((p) => p.overall < outgoingOverall && p.overall >= outgoingOverall - 8);
    if (near.length > 0) return near;
  }
  return biasPoolForEvent(pool, spec.bias, outgoingOverall);
}

/** `count` distinct picks from `pool` (fewer if the pool is smaller), deterministic for a given rng. */
export function drawDistinct<T>(pool: T[], count: number, random: () => number): T[] {
  const copy = [...pool];
  const out: T[] = [];
  while (out.length < count && copy.length > 0) out.push(copy.splice(Math.floor(random() * copy.length), 1)[0]!);
  return out;
}

/** How the finished deal reads: decided by what actually happened, not by the pre-rolled bias. */
export function eventTypeForDelta(delta: number): JanuaryEventType {
  if (delta >= 2) return "POSITIVE";
  if (delta <= -2) return "NEGATIVE";
  return "NEUTRAL";
}
