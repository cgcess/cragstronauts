#!/usr/bin/env bash
#
# seed-local.sh — Populate the LOCAL dev DB with fictitious trips so the
# Cragstronauts UI has something to render. Safe-by-default: refuses to
# run against anything other than a localhost API.
#
# Usage:
#   pnpm seed            # uses http://localhost:8787
#   API=http://... ./scripts/seed-local.sh    # advanced
#
# Seeded data only ever exists in your local Wrangler dev state and is
# wiped by deleting the .wrangler directory.

set -euo pipefail

API="${API:-http://localhost:8787}"

# Hard guard: refuse anything non-local.
case "$API" in
  http://localhost:* | http://127.0.0.1:* )
    ;;
  * )
    echo "seed-local.sh refuses to run against non-local API: $API" >&2
    echo "(local trips only — never seed production)" >&2
    exit 2
    ;;
esac

# Liveness check.
if ! curl -fsS "$API/api/trips" >/dev/null; then
  echo "Could not reach $API/api/trips — is the dev server running? (pnpm turbo dev)" >&2
  exit 1
fi

# YYYY-MM-DD offset, cross-platform.
# BSD `date -v` requires an explicit sign (+N or -N) — without it, "Nd"
# means "set day-of-month to N", not "add N days". Normalise here.
shift_date() {
  local days="$1"
  case "$days" in
    -*) ;;
    *)  days="+${days}" ;;
  esac
  if date -v+1d +%Y-%m-%d >/dev/null 2>&1; then
    date -v"${days}d" +%Y-%m-%d
  else
    # GNU date — strip leading + which it doesn't like
    date -d "${days#+} days" +%Y-%m-%d
  fi
}

# Default gear set every fake trip ships with.
read -r -d '' GEAR_JSON <<'JSON' || true
[
  { "name": "Rack",
    "fields": [
      { "key": "qty", "label": "Quantity", "type": "number" },
      { "key": "note", "label": "Notes", "type": "text" }
    ]
  },
  { "name": "Ropes",
    "fields": [
      { "key": "length", "label": "Length (m)", "type": "number" },
      { "key": "type", "label": "Type", "type": "text" }
    ]
  },
  { "name": "Food & kitchen",
    "fields": [
      { "key": "item", "label": "Item", "type": "text" },
      { "key": "qty", "label": "Quantity", "type": "text" }
    ]
  }
]
JSON

create_trip() {
  local label="$1" start="$2" end="$3" accom_type="$4" accom_det="$5" notes="$6" organizer="$7"
  printf '  · seeding: %s\n' "$label"
  # Build payload with jq if available (safer), else a here-doc.
  local payload
  if command -v jq >/dev/null 2>&1; then
    payload=$(jq -n \
      --arg location "$label" \
      --arg start "$start" \
      --arg end "$end" \
      --arg atype "$accom_type" \
      --arg adet "$accom_det" \
      --arg notes "$notes" \
      --arg organizer "$organizer" \
      --argjson gear "$GEAR_JSON" \
      '{location: $location, start_date: $start, end_date: $end, accommodation_type: $atype, accommodation_details: $adet, notes: $notes, organizer_name: $organizer, gear_categories: $gear}')
  else
    payload=$(cat <<JSON
{
  "location": "$label",
  "start_date": "$start",
  "end_date": "$end",
  "accommodation_type": "$accom_type",
  "accommodation_details": "$accom_det",
  "notes": "$notes",
  "organizer_name": "$organizer",
  "gear_categories": $GEAR_JSON
}
JSON
    )
  fi
  curl -fsS -X POST "$API/api/trips" \
    -H 'Content-Type: application/json' \
    -d "$payload" \
    >/dev/null
}

echo "Seeding local Cragstronauts at $API …"

create_trip "Fontainebleau" \
  "$(shift_date 12)" "$(shift_date 16)" \
  "Gîte" "Le Repère des Grimpeurs · 5 beds" \
  "Sandstone bouldering. Bring brushes and crash pads." \
  "Camille"

create_trip "Chamonix · Aiguilles Rouges" \
  "$(shift_date 34)" "$(shift_date 41)" \
  "Mountain refuge" "Refuge de la Flégère · half-board" \
  "Multi-pitch granite. 60m double ropes." \
  "Lukas"

create_trip "Dolomiti · Cinque Torri" \
  "$(shift_date 70)" "$(shift_date 77)" \
  "Rifugio" "Rifugio Scoiattoli" \
  "Sport + classic alpine multi-pitch. Helmets mandatory." \
  "Nina"

create_trip "Kalymnos" \
  "$(shift_date 120)" "$(shift_date 134)" \
  "Apartment" "Massouri village · 8 pax" \
  "Tufa season. Long routes, 70m rope minimum." \
  "Diogo"

# One past trip so the "Past climbs" section also has something to show.
create_trip "Albarracín" \
  "$(shift_date -90)" "$(shift_date -83)" \
  "Casa rural" "Casa La Vega" \
  "Sandstone bouldering · sent the Hueco traverse." \
  "Magda"

echo "Done. Refresh http://localhost:3000 to see the deck."
