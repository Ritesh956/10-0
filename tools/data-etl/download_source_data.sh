#!/usr/bin/env bash
# Downloads the raw CSVs this ETL depends on from the dcaribou/transfermarkt-datasets
# public mirror (no auth/API key needed). Re-run any time to refresh with newer seasons.
set -euo pipefail

OUT_DIR="${1:-$(dirname "$0")/raw}"
BASE_URL="https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data"
FILES=(games players clubs competitions appearances player_valuations)

mkdir -p "$OUT_DIR"
for f in "${FILES[@]}"; do
  echo "Downloading $f.csv.gz..."
  curl -sL --fail "$BASE_URL/$f.csv.gz" -o "$OUT_DIR/$f.csv.gz"
  gunzip -f "$OUT_DIR/$f.csv.gz"
done

echo "Done. Raw CSVs in $OUT_DIR"
