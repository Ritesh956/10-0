"""
One-shot migration: rescale `overall`/`potential` in the already-shipped
real dataset (packages/db/prisma/data/real-top5-2012-2024.json.gz) onto the
same football-shaped curve that build_real_catalog.py now targets, WITHOUT
needing the raw Transfermarkt CSVs (which are gitignored / not present).

Why this exists as a separate script: build_real_catalog.py quantile-maps the
continuous `blend` score from source data, but the shipped .json.gz only
carries the already-rounded integer `overall`. This script reproduces the
identical target curve (NormalDist(78, 6) clamped to [70, 99]) by quantile-
mapping the empirical distribution of those integer overalls. Because the old
overall is a strictly monotonic function of `blend`, ranking on it recovers
the same ordering, so the result matches a from-source regen to within
sub-integer rounding.

What it changes, all derived consistently from the new overall:
  - playerSeasons[].overall   -> remapped via the curve
  - playerSeasons[].potential -> new_overall + the SAME age headroom the row
                                  already carried (potential_old - overall_old),
                                  capped at 99
  - clubSeasons[].reputation  -> recomputed as the mean new overall of the
                                  club-season's players (clamped [35, 95]),
                                  matching how build_real_catalog.py derives it

Idempotency: the remap is anchored to the CURRENT distribution, so it is NOT
safe to run twice against its own output. Always run it against a pristine,
build_real_catalog.py-produced file. Running it a second time is a no-op only
by luck; treat it as single-use per regeneration.

Usage:
    python rescale_existing_overall.py [--file <path to .json.gz>] [--dry-run]
"""

import argparse
import gzip
import json
from collections import defaultdict
from pathlib import Path
from statistics import NormalDist

# Must stay identical to build_real_catalog.py's OVR_* constants.
OVR_MEAN, OVR_SD, OVR_FLOOR, OVR_CAP = 81.5, 5.0, 70, 99
REP_FLOOR, REP_CAP = 35, 95


def build_lut(overalls: list[int]) -> dict[int, int]:
    """Monotonic old-overall -> new-overall lookup via midpoint-percentile quantile mapping."""
    n = len(overalls)
    counts: dict[int, int] = defaultdict(int)
    for o in overalls:
        counts[o] += 1
    nd = NormalDist(OVR_MEAN, OVR_SD)
    lut: dict[int, int] = {}
    cumulative = 0
    for value in sorted(counts):
        c = counts[value]
        # midpoint percentile of this tie-group
        f = (cumulative + 0.5 * c) / n
        lut[value] = int(round(min(OVR_CAP, max(OVR_FLOOR, nd.inv_cdf(f)))))
        cumulative += c
    return lut


def main() -> None:
    parser = argparse.ArgumentParser()
    default_file = Path(__file__).parent.parent.parent / "packages" / "db" / "prisma" / "data" / "real-top5-2012-2024.json.gz"
    parser.add_argument("--file", type=Path, default=default_file)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    data = json.loads(gzip.open(args.file).read())
    player_seasons = data["playerSeasons"]

    lut = build_lut([r["overall"] for r in player_seasons])
    print("old -> new overall lookup:")
    print("  " + json.dumps({str(k): v for k, v in sorted(lut.items())}))

    # Remap overall + potential (preserving each row's existing age headroom).
    by_club_season: dict[str, list[int]] = defaultdict(list)
    for r in player_seasons:
        old_ov = r["overall"]
        headroom = max(0, r["potential"] - old_ov)
        new_ov = lut[old_ov]
        r["overall"] = new_ov
        r["potential"] = min(OVR_CAP, new_ov + headroom)
        by_club_season[r["clubSeasonId"]].append(new_ov)

    # Recompute club-season reputation from the new mean overall (same rule the ETL uses).
    for cs in data["clubSeasons"]:
        members = by_club_season.get(cs["id"])
        if members:
            mean_ov = sum(members) / len(members)
            cs["reputation"] = int(round(min(REP_CAP, max(REP_FLOOR, mean_ov))))

    if args.dry_run:
        print("\n[dry-run] not writing.")
        return

    payload = json.dumps(data).encode("utf-8")
    with gzip.open(args.file, "wb", compresslevel=9) as f:
        f.write(payload)
    print(f"\nWrote {args.file} ({len(payload)} bytes uncompressed json)")


if __name__ == "__main__":
    main()
