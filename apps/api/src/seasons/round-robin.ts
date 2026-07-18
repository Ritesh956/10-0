export interface RoundRobinFixture {
  matchday: number;
  homeClubId: string;
  awayClubId: string;
}

const BYE = "__BYE__";

/**
 * Circle-method double round-robin: every pair of clubs plays each other
 * home and away. Odd club counts get a bye each round via a placeholder slot.
 */
export function generateDoubleRoundRobin(clubIds: string[]): RoundRobinFixture[] {
  if (clubIds.length < 2) return [];

  const ids = [...clubIds];
  if (ids.length % 2 !== 0) ids.push(BYE);

  const n = ids.length;
  const rounds = n - 1;
  const half = n / 2;
  const firstLeg: RoundRobinFixture[] = [];
  let arr = [...ids];

  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < half; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a === undefined || b === undefined || a === BYE || b === BYE) continue;
      const [home, away] = round % 2 === 0 ? [a, b] : [b, a];
      firstLeg.push({ matchday: round + 1, homeClubId: home, awayClubId: away });
    }
    const fixed = arr[0] as string;
    const rest = arr.slice(1);
    const last = rest.pop();
    if (last !== undefined) rest.unshift(last);
    arr = [fixed, ...rest];
  }

  const secondLeg: RoundRobinFixture[] = firstLeg.map((f) => ({
    matchday: f.matchday + rounds,
    homeClubId: f.awayClubId,
    awayClubId: f.homeClubId,
  }));

  return [...firstLeg, ...secondLeg];
}
