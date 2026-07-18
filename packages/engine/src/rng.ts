/**
 * Deterministic PRNG. The engine must never touch Math.random or the
 * system clock — every draw comes from this stream so that
 * simulate(setup, seed) is a pure function of its inputs.
 */
export type Rng = () => number;

function seedToUint32(seed: bigint): number {
  const masked = BigInt.asUintN(64, seed);
  const lo = Number(masked & 0xffffffffn);
  const hi = Number((masked >> 32n) & 0xffffffffn);
  return (lo ^ hi ^ 0x9e3779b9) >>> 0;
}

/** mulberry32 — fast, small-state, good-enough statistical quality for gameplay. */
export function createRng(seed: bigint): Rng {
  let state = seedToUint32(seed);
  return function next(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform float in [min, max). */
export function uniform(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Integer in [0, length) — for weighted/array selection. */
export function randomIndex(rng: Rng, length: number): number {
  return Math.min(length - 1, Math.floor(rng() * length));
}

/** Weighted random pick; weights need not sum to 1. Falls back to uniform if all weights are ~0. */
export function weightedPick<T>(rng: Rng, items: T[], weights: number[]): T {
  const total = weights.reduce((sum, w) => sum + Math.max(w, 0), 0);
  if (total <= 0 || items.length === 0) {
    const first = items[randomIndex(rng, items.length)];
    if (first === undefined) throw new Error("weightedPick: empty items array");
    return first;
  }
  let roll = rng() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= Math.max(weights[i] ?? 0, 0);
    if (roll <= 0) return items[i] as T;
  }
  return items[items.length - 1] as T;
}
