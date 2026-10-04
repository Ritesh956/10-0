"""
One-shot migration: applies ovr_spread.py's stage-2 curve to the already-shipped dataset
(packages/db/prisma/data/real-top5-2012-2025.json.gz) without the raw Transfermarkt CSVs.

The shipped file's integer `overall` is the stage-1 value (70-99), so this is an exact per-integer
remap — no re-ranking needed. It refuses to run on a file that already looks remapped (anything
below 70), so it can't be applied twice. Also remaps `potential` through the same curve and
recomputes club-season `reputation` (mean overall, clamped [35, 95]) the same way the ETL does.

After running it, reseed with `pnpm seed:real` (from packages/db) — the seed syncs overall,
potential, attributes and reputation onto existing rows.

Usage:
    python apply_ovr_spread.py [--file <path>] [--dry-run]
"""

import argparse
import gzip
import json
from collections import defaultdict
from pathlib import Path

from ovr_spread import spread

REP_FLOOR, REP_CAP = 35, 95


def main() -> None:
    parser = argparse.ArgumentParser()
    default_file = Path(__file__).parent.parent.parent / "packages" / "db" / "prisma" / "data" / "real-top5-2012-2025.json.gz"
    parser.add_argument("--file", type=Path, default=default_file)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    data = json.loads(gzip.open(args.file).read())
    player_seasons = data["playerSeasons"]
    if min(r["overall"] for r in player_seasons) < 70:
        raise SystemExit("This file already has overalls below 70 — the spread curve looks applied already.")

    print("stage-1 -> final:", {o: spread(o) for o in range(70, 100)})
    by_club_season: dict[str, list[int]] = defaultdict(list)
    for r in player_seasons:
        r["overall"] = spread(r["overall"])
        r["potential"] = max(r["overall"], spread(r["potential"]))
        by_club_season[r["clubSeasonId"]].append(r["overall"])

    for cs in data["clubSeasons"]:
        members = by_club_season.get(cs["id"])
        if members:
            cs["reputation"] = int(round(min(REP_CAP, max(REP_FLOOR, sum(members) / len(members)))))

    if args.dry_run:
        print("[dry-run] not writing.")
        return
    payload = json.dumps(data).encode("utf-8")
    with gzip.open(args.file, "wb", compresslevel=9) as f:
        f.write(payload)
    print(f"Wrote {args.file} ({len(payload)} bytes uncompressed json)")


if __name__ == "__main__":
    main()
