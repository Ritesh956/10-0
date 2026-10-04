"""
The second stage of the OVERALL curve, shared by build_real_catalog.py and apply_ovr_spread.py.

Stage 1 (build_real_catalog.py) quantile-maps the blended score onto NormalDist(81.5, 5) clamped to
[70, 99]. That shape was right but too compressed at the top: every Premier League club's best XI
landed between 83 and 91, so the simulated league table was flat (champion ~68 pts, Liverpool
finishing mid-table) and nearly every drafted XI rated 88-90 ("Galacticos"). Stage 2 stretches the
upper half and lowers the floor with a monotonic piecewise-linear map, so that:

  - 90+ is genuinely world-class (top ~1.5% of player-seasons; was top ~5%)
  - a league's best and worst XIs sit ~12-16 points apart (was ~8), which is what gives the sim a
    realistic table (champion ~80-90 pts, safety line ~35) — measured in tools/sim-lab
    (`pnpm --filter @futbol/sim-lab exec tsx src/calibrate.ts`)
  - a typical drafted XI lands in the low-to-mid 80s instead of ~90

Keep SPREAD_ANCHORS in sync with packages/engine/src/testing/rating-scale.ts (which maps the final
overall onto engine quality) — the two were tuned together.
"""

import math

# (stage-1 overall, final overall), linear in between.
SPREAD_ANCHORS = [
    (70, 58), (75, 64), (78, 68), (81, 72), (84, 76), (86, 79), (88, 82),
    (90, 85), (92, 88), (93, 90), (95, 92), (98, 95), (99, 97),
]
FINAL_FLOOR, FINAL_CAP = 58, 97


def spread(stage1: float) -> int:
    """Stage-1 overall (may be fractional) -> final integer overall, rounding halves up."""
    x = min(max(stage1, SPREAD_ANCHORS[0][0]), SPREAD_ANCHORS[-1][0])
    for (x0, y0), (x1, y1) in zip(SPREAD_ANCHORS, SPREAD_ANCHORS[1:]):
        if x <= x1:
            return int(math.floor(y0 + (y1 - y0) * (x - x0) / (x1 - x0) + 0.5))
    return FINAL_CAP
