"""
Builds packages/db/prisma/data/real-top5-2012-2024.json.gz — the real
reference-catalog dataset consumed by packages/db/prisma/seed-real.ts.

Source: dcaribou/transfermarkt-datasets (https://github.com/dcaribou/transfermarkt-datasets),
a CC-licensed, weekly-refreshed extract of public Transfermarkt data. Run
download_source_data.sh first to fetch the raw CSVs this script reads.

This script only uses real, factual data (player names, positions, club
names, appearances, goals/assists, market value) — it does NOT scrape or
reuse any FIFA/EA-style "OVR" rating. `overall`/`potential` are computed here
from a blend of market value percentile, position-relative per-90 goal
contribution, and involvement (minutes played), specifically so we're never
copying a third party's proprietary rating.

Usage:
    python build_real_catalog.py [--data-dir raw] [--out ../../packages/db/prisma/data/real-top5-2012-2024.json.gz]
"""

import argparse
import gzip
import json
import re
from pathlib import Path

import numpy as np
import pandas as pd

TOP5 = {"GB1": "England", "ES1": "Spain", "IT1": "Italy", "L1": "Germany", "FR1": "France"}
TOP5_NAMES = {"GB1": "Premier League", "ES1": "LaLiga", "IT1": "Serie A", "L1": "Bundesliga", "FR1": "Ligue 1"}
SEASON_MIN, SEASON_MAX = 2012, 2024
MIN_MINUTES = 300

POSITION_MAP = {
    "Goalkeeper": "GK",
    "Centre-Back": "CB",
    "Left-Back": "LB",
    "Right-Back": "RB",
    "Defensive Midfield": "CDM",
    "Central Midfield": "CM",
    "Attacking Midfield": "CAM",
    "Left Midfield": "LM",
    "Right Midfield": "RM",
    "Left Winger": "LW",
    "Right Winger": "RW",
    "Centre-Forward": "ST",
    "Second Striker": "CF",
}

DEFENSIVE = {"GK", "CB", "LB", "RB", "CDM"}
CREATIVE = {"CM", "CAM", "LM", "RM"}
ATTACKING = {"LW", "RW", "ST", "CF"}


def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def main() -> None:
    parser = argparse.ArgumentParser()
    default_data_dir = Path(__file__).parent / "raw"
    default_out = Path(__file__).parent.parent.parent / "packages" / "db" / "prisma" / "data" / "real-top5-2012-2024.json.gz"
    parser.add_argument("--data-dir", type=Path, default=default_data_dir)
    parser.add_argument("--out", type=Path, default=default_out)
    args = parser.parse_args()
    data = args.data_dir

    print("Loading games...")
    games = pd.read_csv(data / "games.csv", usecols=["game_id", "competition_id", "season"])
    games = games[games.competition_id.isin(TOP5) & games.season.between(SEASON_MIN, SEASON_MAX)]
    game_lookup = games.set_index("game_id")[["competition_id", "season"]]
    qualifying_game_ids = set(game_lookup.index)
    print(f"  {len(qualifying_game_ids)} qualifying games")

    print("Streaming appearances...")
    app_chunks = []
    cols = ["game_id", "player_id", "player_club_id", "goals", "assists", "yellow_cards", "red_cards", "minutes_played"]
    for c in pd.read_csv(data / "appearances.csv", usecols=cols, chunksize=250_000):
        c = c[c.game_id.isin(qualifying_game_ids)]
        if len(c):
            app_chunks.append(c)
    app = pd.concat(app_chunks, ignore_index=True)
    app = app.merge(game_lookup, left_on="game_id", right_index=True, how="inner")
    print(f"  {len(app)} qualifying appearance rows")

    print("Aggregating per player-club-season...")
    agg = (
        app.groupby(["player_id", "player_club_id", "season", "competition_id"])
        .agg(
            apps=("game_id", "count"),
            minutes=("minutes_played", "sum"),
            goals=("goals", "sum"),
            assists=("assists", "sum"),
            yellows=("yellow_cards", "sum"),
            reds=("red_cards", "sum"),
        )
        .reset_index()
    )
    agg = agg[agg.minutes >= MIN_MINUTES].copy()
    print(f"  {len(agg)} player-club-season rows after minutes filter")

    print("Loading players/clubs/competitions/valuations...")
    players = pd.read_csv(
        data / "players.csv",
        usecols=[
            "player_id",
            "name",
            "date_of_birth",
            "sub_position",
            "foot",
            "country_of_citizenship",
            "country_of_birth",
            "image_url",
        ],
    )
    clubs = pd.read_csv(data / "clubs.csv", usecols=["club_id", "name", "domestic_competition_id"])
    comps = pd.read_csv(data / "competitions.csv", usecols=["competition_id", "country_name"])
    val = pd.read_csv(data / "player_valuations.csv", usecols=["player_id", "date", "market_value_in_eur"])

    val["date"] = pd.to_datetime(val["date"])
    # European season runs Aug-Jul; assign each valuation to the season it falls within.
    val["season"] = val["date"].dt.year - (val["date"].dt.month < 7).astype(int)
    val_season = val.groupby(["player_id", "season"])["market_value_in_eur"].mean().reset_index()

    agg = agg.merge(val_season, on=["player_id", "season"], how="left")
    agg = agg.sort_values(["player_id", "season"])
    agg["market_value_in_eur"] = agg.groupby("player_id")["market_value_in_eur"].transform(lambda s: s.ffill().bfill())
    agg["market_value_in_eur"] = agg["market_value_in_eur"].fillna(agg["market_value_in_eur"].median())

    agg = agg.merge(players, on="player_id", how="left")
    agg = agg.merge(clubs.rename(columns={"club_id": "player_club_id", "name": "club_name"}), on="player_club_id", how="left")
    agg = agg.merge(
        comps.rename(columns={"competition_id": "comp_country"}), left_on="competition_id", right_on="comp_country", how="left"
    )

    agg = agg.dropna(subset=["name", "sub_position", "date_of_birth"])
    agg["position"] = agg["sub_position"].map(POSITION_MAP)
    agg = agg.dropna(subset=["position"])
    print(f"  {len(agg)} rows after bio join + position mapping")

    agg["date_of_birth"] = pd.to_datetime(agg["date_of_birth"], errors="coerce")
    agg = agg.dropna(subset=["date_of_birth"])
    agg["age"] = agg["season"] - agg["date_of_birth"].dt.year

    print("Computing scores...")
    agg["value_score"] = agg["market_value_in_eur"].rank(pct=True)
    agg["minutes_score"] = agg["minutes"].rank(pct=True)

    per90 = (agg["goals"] + 0.7 * agg["assists"]) / (agg["minutes"] / 90.0).clip(lower=1)
    agg["_per90"] = per90
    agg["perf_score"] = agg.groupby("position")["_per90"].transform(lambda g: g.rank(pct=True))

    is_def = agg["position"].isin(DEFENSIVE)
    is_atk = agg["position"].isin(ATTACKING)

    w_value = np.where(is_def, 0.65, np.where(is_atk, 0.50, 0.55))
    w_perf = np.where(is_def, 0.10, np.where(is_atk, 0.30, 0.25))
    w_inv = np.where(is_def, 0.25, np.where(is_atk, 0.20, 0.20))

    blend = w_value * agg["value_score"] + w_perf * agg["perf_score"] + w_inv * agg["minutes_score"]
    agg["overall"] = (40 + 59 * blend).round().clip(40, 99).astype(int)

    age_bonus = ((25 - agg["age"]).clip(lower=0) * 0.8).round()
    agg["potential"] = (agg["overall"] + age_bonus).clip(upper=99)
    agg["potential"] = agg[["overall", "potential"]].max(axis=1).astype(int)

    agg["preferred_foot"] = agg["foot"].map({"right": "right", "left": "left", "both": "both"}).fillna("right")

    print("Filtering out non-viable club-seasons (no GK, or too few players to fill an XI)...")
    MIN_SQUAD_SIZE = 14
    cs_key_cols = ["player_club_id", "season", "competition_id"]
    squad_counts = agg.groupby(cs_key_cols).size().rename("squad_size")
    has_gk = agg.groupby(cs_key_cols)["position"].apply(lambda s: (s == "GK").any()).rename("has_gk")
    viability = pd.concat([squad_counts, has_gk], axis=1).reset_index()
    viable_keys = viability[(viability.squad_size >= MIN_SQUAD_SIZE) & viability.has_gk][cs_key_cols]
    before = len(agg)
    agg = agg.merge(viable_keys, on=cs_key_cols, how="inner")
    dropped_cs = len(viability) - len(viable_keys)
    print(f"  dropped {dropped_cs} non-viable club-seasons ({before - len(agg)} player-season rows)")

    print("Building output structures...")
    leagues = [{"id": f"league-{code.lower()}", "name": TOP5_NAMES[code], "country": TOP5[code], "tier": 1} for code in TOP5]

    club_ids = agg["player_club_id"].unique()
    clubs_lookup = clubs.set_index("club_id")
    club_rows = []
    seen = set()
    for cid in club_ids:
        if cid in seen or cid not in clubs_lookup.index:
            continue
        seen.add(cid)
        row = clubs_lookup.loc[cid]
        name = row["name"] if isinstance(row, pd.Series) else row.iloc[0]["name"]
        dom_comp = row["domestic_competition_id"] if isinstance(row, pd.Series) else row.iloc[0]["domestic_competition_id"]
        club_rows.append({"id": f"tm-club-{int(cid)}", "name": str(name), "country": TOP5.get(dom_comp, "Europe")})

    cs_group = agg.groupby(["player_club_id", "season", "competition_id"])["overall"].mean().reset_index()
    club_season_rows = []
    club_season_key_to_id = {}
    for _, r in cs_group.iterrows():
        cid, season, comp = int(r["player_club_id"]), int(r["season"]), r["competition_id"]
        cs_id = f"tm-cs-{cid}-{season}-{comp}"
        club_season_key_to_id[(cid, season, comp)] = cs_id
        club_season_rows.append(
            {
                "id": cs_id,
                "clubId": f"tm-club-{cid}",
                "seasonYear": season,
                "leagueId": f"league-{comp.lower()}",
                "reputation": int(round(min(95, max(35, r["overall"])))),
            }
        )

    player_bio = agg.drop_duplicates(subset=["player_id"])[
        ["player_id", "name", "country_of_citizenship", "country_of_birth", "date_of_birth", "image_url"]
    ]
    player_rows = []
    for _, r in player_bio.iterrows():
        nat = r["country_of_citizenship"]
        if pd.isna(nat):
            nat = r["country_of_birth"] if not pd.isna(r["country_of_birth"]) else "Unknown"
        player_rows.append(
            {
                "id": f"tm-player-{int(r['player_id'])}",
                "name": str(r["name"]),
                "nationality": str(nat),
                "dateOfBirth": r["date_of_birth"].strftime("%Y-%m-%d"),
                "photoUrl": None if pd.isna(r["image_url"]) else str(r["image_url"]),
            }
        )

    player_season_rows = []
    for _, r in agg.iterrows():
        cid, season, comp = int(r["player_club_id"]), int(r["season"]), r["competition_id"]
        cs_id = club_season_key_to_id.get((cid, season, comp))
        if cs_id is None:
            continue
        pid = int(r["player_id"])
        player_season_rows.append(
            {
                "id": f"tm-ps-{pid}-{cs_id}",
                "playerId": f"tm-player-{pid}",
                "clubSeasonId": cs_id,
                "seasonYear": season,
                "positions": [r["position"]],
                "preferredFoot": r["preferred_foot"],
                "overall": int(r["overall"]),
                "potential": int(r["potential"]),
            }
        )

    print(
        f"leagues={len(leagues)} clubs={len(club_rows)} clubSeasons={len(club_season_rows)} "
        f"players={len(player_rows)} playerSeasons={len(player_season_rows)}"
    )

    args.out.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(
        {
            "leagues": leagues,
            "clubs": club_rows,
            "clubSeasons": club_season_rows,
            "players": player_rows,
            "playerSeasons": player_season_rows,
        }
    ).encode("utf-8")
    with gzip.open(args.out, "wb", compresslevel=9) as f:
        f.write(payload)

    print("Wrote", args.out)


if __name__ == "__main__":
    main()
