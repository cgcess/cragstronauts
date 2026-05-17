"""Climbing trip planner backend (FastAPI + SQLite).

Single-trip for now, but every row carries trip_id so multi-trip is a future change.
"""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

DB_PATH = Path(__file__).parent / "trip.db"
DEFAULT_TRIP_ID = 1


# ---------- DB ----------

def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def db():
    conn = _connect()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS trip (
                id INTEGER PRIMARY KEY,
                location TEXT NOT NULL,
                start_date TEXT,
                end_date TEXT,
                accommodation_type TEXT,
                accommodation_details TEXT,
                notes TEXT
            );
            CREATE TABLE IF NOT EXISTS user (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                trip_id INTEGER NOT NULL REFERENCES trip(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                joining INTEGER NOT NULL DEFAULT 1,
                is_organizer INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS gear_category (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                trip_id INTEGER NOT NULL REFERENCES trip(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                fields TEXT NOT NULL  -- JSON array of {key,label,type}
            );
            CREATE TABLE IF NOT EXISTS car (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                trip_id INTEGER NOT NULL REFERENCES trip(id) ON DELETE CASCADE,
                driver_user_id INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
                total_seats INTEGER NOT NULL,
                notes TEXT
            );
            CREATE TABLE IF NOT EXISTS car_signup (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                car_id INTEGER NOT NULL REFERENCES car(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
                UNIQUE(car_id, user_id)
            );
            CREATE TABLE IF NOT EXISTS gear_contribution (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                trip_id INTEGER NOT NULL REFERENCES trip(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
                category_id INTEGER NOT NULL REFERENCES gear_category(id) ON DELETE CASCADE,
                details TEXT NOT NULL  -- JSON dict
            );
            """
        )


# ---------- Schemas ----------

class GearField(BaseModel):
    key: str
    label: str
    type: str = "text"  # text | number


class TripIn(BaseModel):
    location: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    accommodation_type: Optional[str] = None
    accommodation_details: Optional[str] = None
    notes: Optional[str] = None
    gear_categories: list[dict[str, Any]] = Field(default_factory=list)
    organizer_name: str


class TripOut(BaseModel):
    id: int
    location: str
    start_date: Optional[str]
    end_date: Optional[str]
    accommodation_type: Optional[str]
    accommodation_details: Optional[str]
    notes: Optional[str]


class UserIn(BaseModel):
    name: str
    joining: bool = True


class UserPatch(BaseModel):
    name: Optional[str] = None
    joining: Optional[bool] = None


class UserOut(BaseModel):
    id: int
    name: str
    joining: bool
    is_organizer: bool


class GearCategoryIn(BaseModel):
    name: str
    fields: list[GearField] = Field(default_factory=list)


class GearCategoryOut(BaseModel):
    id: int
    name: str
    fields: list[GearField]


class CarIn(BaseModel):
    driver_user_id: int
    total_seats: int
    notes: Optional[str] = None


class CarOut(BaseModel):
    id: int
    driver_user_id: int
    driver_name: str
    total_seats: int
    notes: Optional[str]
    passengers: list[dict[str, Any]]  # [{user_id, name}]


class CarSignupIn(BaseModel):
    user_id: int


class GearContribIn(BaseModel):
    user_id: int
    category_id: int
    details: dict[str, Any]


class GearContribOut(BaseModel):
    id: int
    user_id: int
    user_name: str
    category_id: int
    category_name: str
    details: dict[str, Any]


# ---------- App ----------

app = FastAPI(title="Climbing Trip Planner")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


# ---------- Trip ----------

def _trip_row(conn: sqlite3.Connection) -> Optional[sqlite3.Row]:
    return conn.execute("SELECT * FROM trip WHERE id=?", (DEFAULT_TRIP_ID,)).fetchone()


@app.get("/api/trip")
def get_trip() -> Optional[dict[str, Any]]:
    with db() as conn:
        row = _trip_row(conn)
        if not row:
            return None
        return dict(row)


@app.post("/api/trip")
def create_trip(payload: TripIn) -> dict[str, Any]:
    with db() as conn:
        if _trip_row(conn):
            raise HTTPException(409, "Trip already exists")
        conn.execute(
            """INSERT INTO trip(id, location, start_date, end_date,
               accommodation_type, accommodation_details, notes)
               VALUES (?,?,?,?,?,?,?)""",
            (
                DEFAULT_TRIP_ID,
                payload.location,
                payload.start_date,
                payload.end_date,
                payload.accommodation_type,
                payload.accommodation_details,
                payload.notes,
            ),
        )
        # Gear categories
        for cat in payload.gear_categories:
            name = cat.get("name")
            fields = cat.get("fields", [])
            if not name:
                continue
            conn.execute(
                "INSERT INTO gear_category(trip_id, name, fields) VALUES (?,?,?)",
                (DEFAULT_TRIP_ID, name, json.dumps(fields)),
            )
        # Organizer user
        cur = conn.execute(
            "INSERT INTO user(trip_id, name, joining, is_organizer) VALUES (?,?,?,?)",
            (DEFAULT_TRIP_ID, payload.organizer_name, 1, 1),
        )
        organizer_id = cur.lastrowid
    return {"trip_id": DEFAULT_TRIP_ID, "organizer_user_id": organizer_id}


# ---------- Users ----------

def _row_to_user(r: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": r["id"],
        "name": r["name"],
        "joining": bool(r["joining"]),
        "is_organizer": bool(r["is_organizer"]),
    }


@app.get("/api/users")
def list_users() -> list[dict[str, Any]]:
    with db() as conn:
        rows = conn.execute(
            "SELECT * FROM user WHERE trip_id=? ORDER BY id", (DEFAULT_TRIP_ID,)
        ).fetchall()
        return [_row_to_user(r) for r in rows]


@app.post("/api/users")
def create_user(payload: UserIn) -> dict[str, Any]:
    name = payload.name.strip()
    if not name:
        raise HTTPException(400, "Name required")
    with db() as conn:
        if not _trip_row(conn):
            raise HTTPException(400, "Trip not configured yet")
        cur = conn.execute(
            "INSERT INTO user(trip_id, name, joining) VALUES (?,?,?)",
            (DEFAULT_TRIP_ID, name, 1 if payload.joining else 0),
        )
        row = conn.execute("SELECT * FROM user WHERE id=?", (cur.lastrowid,)).fetchone()
        return _row_to_user(row)


@app.patch("/api/users/{user_id}")
def update_user(user_id: int, payload: UserPatch) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute("SELECT * FROM user WHERE id=?", (user_id,)).fetchone()
        if not row:
            raise HTTPException(404, "User not found")
        new_name = payload.name.strip() if payload.name is not None else row["name"]
        if not new_name:
            raise HTTPException(400, "Name cannot be empty")
        new_joining = (
            (1 if payload.joining else 0)
            if payload.joining is not None
            else row["joining"]
        )
        conn.execute(
            "UPDATE user SET name=?, joining=? WHERE id=?",
            (new_name, new_joining, user_id),
        )
        row = conn.execute("SELECT * FROM user WHERE id=?", (user_id,)).fetchone()
        return _row_to_user(row)


# ---------- Gear categories ----------

def _row_to_cat(r: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": r["id"],
        "name": r["name"],
        "fields": json.loads(r["fields"]) if r["fields"] else [],
    }


@app.get("/api/gear-categories")
def list_gear_categories() -> list[dict[str, Any]]:
    with db() as conn:
        rows = conn.execute(
            "SELECT * FROM gear_category WHERE trip_id=? ORDER BY id",
            (DEFAULT_TRIP_ID,),
        ).fetchall()
        return [_row_to_cat(r) for r in rows]


@app.post("/api/gear-categories")
def add_gear_category(payload: GearCategoryIn) -> dict[str, Any]:
    with db() as conn:
        cur = conn.execute(
            "INSERT INTO gear_category(trip_id, name, fields) VALUES (?,?,?)",
            (
                DEFAULT_TRIP_ID,
                payload.name,
                json.dumps([f.model_dump() for f in payload.fields]),
            ),
        )
        row = conn.execute(
            "SELECT * FROM gear_category WHERE id=?", (cur.lastrowid,)
        ).fetchone()
        return _row_to_cat(row)


@app.delete("/api/gear-categories/{cat_id}")
def delete_gear_category(cat_id: int) -> dict[str, bool]:
    with db() as conn:
        conn.execute("DELETE FROM gear_category WHERE id=?", (cat_id,))
    return {"ok": True}


# ---------- Cars ----------

def _car_to_dict(conn: sqlite3.Connection, r: sqlite3.Row) -> dict[str, Any]:
    driver = conn.execute(
        "SELECT name FROM user WHERE id=?", (r["driver_user_id"],)
    ).fetchone()
    passengers = conn.execute(
        """SELECT u.id as user_id, u.name as name
           FROM car_signup cs JOIN user u ON u.id = cs.user_id
           WHERE cs.car_id=? ORDER BY cs.id""",
        (r["id"],),
    ).fetchall()
    return {
        "id": r["id"],
        "driver_user_id": r["driver_user_id"],
        "driver_name": driver["name"] if driver else "(unknown)",
        "total_seats": r["total_seats"],
        "notes": r["notes"],
        "passengers": [dict(p) for p in passengers],
    }


@app.get("/api/cars")
def list_cars() -> list[dict[str, Any]]:
    with db() as conn:
        rows = conn.execute(
            "SELECT * FROM car WHERE trip_id=? ORDER BY id", (DEFAULT_TRIP_ID,)
        ).fetchall()
        return [_car_to_dict(conn, r) for r in rows]


@app.post("/api/cars")
def create_car(payload: CarIn) -> dict[str, Any]:
    if payload.total_seats < 1:
        raise HTTPException(400, "total_seats must be >= 1")
    with db() as conn:
        # one car per driver
        existing = conn.execute(
            "SELECT id FROM car WHERE driver_user_id=?", (payload.driver_user_id,)
        ).fetchone()
        if existing:
            conn.execute(
                "UPDATE car SET total_seats=?, notes=? WHERE id=?",
                (payload.total_seats, payload.notes, existing["id"]),
            )
            car_id = existing["id"]
        else:
            cur = conn.execute(
                "INSERT INTO car(trip_id, driver_user_id, total_seats, notes) VALUES (?,?,?,?)",
                (DEFAULT_TRIP_ID, payload.driver_user_id, payload.total_seats, payload.notes),
            )
            car_id = cur.lastrowid
        row = conn.execute("SELECT * FROM car WHERE id=?", (car_id,)).fetchone()
        return _car_to_dict(conn, row)


@app.delete("/api/cars/{car_id}")
def delete_car(car_id: int) -> dict[str, bool]:
    with db() as conn:
        conn.execute("DELETE FROM car WHERE id=?", (car_id,))
    return {"ok": True}


@app.post("/api/cars/{car_id}/signup")
def car_signup(car_id: int, payload: CarSignupIn) -> dict[str, Any]:
    with db() as conn:
        car = conn.execute("SELECT * FROM car WHERE id=?", (car_id,)).fetchone()
        if not car:
            raise HTTPException(404, "Car not found")
        taken = conn.execute(
            "SELECT COUNT(*) AS c FROM car_signup WHERE car_id=?", (car_id,)
        ).fetchone()["c"]
        # seats available = total_seats - 1 (driver) ... no, treat total_seats as passenger seats; let's clarify:
        # we'll treat total_seats as TOTAL seats including driver, so passenger capacity = total_seats - 1
        capacity = max(0, car["total_seats"] - 1)
        if taken >= capacity:
            raise HTTPException(400, "Car is full")
        if payload.user_id == car["driver_user_id"]:
            raise HTTPException(400, "Driver is already in the car")
        try:
            conn.execute(
                "INSERT INTO car_signup(car_id, user_id) VALUES (?,?)",
                (car_id, payload.user_id),
            )
        except sqlite3.IntegrityError:
            raise HTTPException(400, "Already signed up")
        row = conn.execute("SELECT * FROM car WHERE id=?", (car_id,)).fetchone()
        return _car_to_dict(conn, row)


@app.delete("/api/cars/{car_id}/signup/{user_id}")
def car_signoff(car_id: int, user_id: int) -> dict[str, Any]:
    with db() as conn:
        conn.execute(
            "DELETE FROM car_signup WHERE car_id=? AND user_id=?", (car_id, user_id)
        )
        row = conn.execute("SELECT * FROM car WHERE id=?", (car_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Car not found")
        return _car_to_dict(conn, row)


# ---------- Gear contributions ----------

def _contrib_to_dict(conn: sqlite3.Connection, r: sqlite3.Row) -> dict[str, Any]:
    user = conn.execute("SELECT name FROM user WHERE id=?", (r["user_id"],)).fetchone()
    cat = conn.execute(
        "SELECT name FROM gear_category WHERE id=?", (r["category_id"],)
    ).fetchone()
    return {
        "id": r["id"],
        "user_id": r["user_id"],
        "user_name": user["name"] if user else "(unknown)",
        "category_id": r["category_id"],
        "category_name": cat["name"] if cat else "(unknown)",
        "details": json.loads(r["details"]),
    }


@app.get("/api/gear")
def list_gear() -> list[dict[str, Any]]:
    with db() as conn:
        rows = conn.execute(
            "SELECT * FROM gear_contribution WHERE trip_id=? ORDER BY id",
            (DEFAULT_TRIP_ID,),
        ).fetchall()
        return [_contrib_to_dict(conn, r) for r in rows]


@app.post("/api/gear")
def add_gear(payload: GearContribIn) -> dict[str, Any]:
    with db() as conn:
        cur = conn.execute(
            """INSERT INTO gear_contribution(trip_id, user_id, category_id, details)
               VALUES (?,?,?,?)""",
            (
                DEFAULT_TRIP_ID,
                payload.user_id,
                payload.category_id,
                json.dumps(payload.details),
            ),
        )
        row = conn.execute(
            "SELECT * FROM gear_contribution WHERE id=?", (cur.lastrowid,)
        ).fetchone()
        return _contrib_to_dict(conn, row)


@app.delete("/api/gear/{contrib_id}")
def delete_gear(contrib_id: int) -> dict[str, bool]:
    with db() as conn:
        conn.execute("DELETE FROM gear_contribution WHERE id=?", (contrib_id,))
    return {"ok": True}


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
