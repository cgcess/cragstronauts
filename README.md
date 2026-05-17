# Climbing Trip Planner

A small webapp for coordinating a single group climbing trip: the organizer sets up the trip (location, dates, accommodation, gear categories), and other participants land on the app, join, complete a signup swipe, and contribute cars and gear from the main tabs.

## Architecture

- **Backend** — FastAPI + SQLite (`backend/app.py`). The database file `trip.db` is created automatically on first startup. Runs on port `8000` and exposes a JSON API under `/api/*`.
- **Frontend** — React 18 + Vite + framer-motion (`frontend/`). Runs on port `3000`. A stage machine in `src/App.jsx` routes between the Organizer Wizard, Landing, Signup Swipe, and the Main Tabs (Info / Cars / Gear).
- **Schema** is single-trip today (everything is scoped to `DEFAULT_TRIP_ID = 1`), but each row carries a `trip_id` so multi-trip is a future change.

## Requirements

- Python 3.10+ (uses PEP 604 type syntax)
- Node.js 18+ and npm

Python packages are listed in `requirements_python.txt`. JS packages are listed in `frontend/package.json` (also mirrored in `requirements_javascript.txt` for reference).

## Running locally

### 1. Backend

```bash
cd backend
pip install -r ../requirements_python.txt
python3 -m uvicorn app:app --host 0.0.0.0 --port 8000
```

The backend will create `backend/trip.db` on first run. Delete that file to reset all state.

### 2. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Then open http://localhost:3000. The Vite dev server proxies API calls to the backend on port 8000 (CORS is also wide open on the backend, so direct calls work too).

## Resetting

- **Wipe the trip:** stop the backend, delete `backend/trip.db`, and restart. The schema is recreated on startup.
- **Switch user in the browser:** use the "switch user" action in the UI, or clear the `climbingTrip.userId` and `climbingTrip.signupDone.*` keys from localStorage.
