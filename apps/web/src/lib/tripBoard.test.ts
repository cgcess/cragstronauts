import { describe, it, expect } from "vitest";
import { buildTripBoard, type TripEntry } from "./tripBoard";

const TODAY = "2026-07-28";

const trip = (
  id: string,
  name: string,
  start: string | null,
  end: string | null = start
): TripEntry =>
  ({
    id,
    name,
    location: "",
    start_date: start,
    end_date: end,
  }) as TripEntry;

// The three past trips from the real board, in the order the API returned them.
const spielberg = trip("s", "Spielberg Climbing", "2026-06-26", "2026-06-28"); // 32 days ago
const lobejun = trip("l", "Löbejün Climbing", "2026-07-10", "2026-07-12"); //    18 days ago
const boys = trip("b", "Boys weekend", "2026-07-25", "2026-07-26"); //            3 days ago

describe("buildTripBoard", () => {
  it("features the most recent past trip when nothing is upcoming", () => {
    const board = buildTripBoard([spielberg, lobejun, boys], TODAY);

    expect(board.hero?.trip.name).toBe("Boys weekend");
    expect(board.hero?.model.status).toBe("past");
    expect(Math.abs(board.hero!.model.daysUntil)).toBe(3);
  });

  it("orders the past list most recent first", () => {
    const board = buildTripBoard([spielberg, lobejun, boys], TODAY);

    // Hero takes the most recent; the rest descend into the archive.
    expect(board.pastTrips.map((x) => x.trip.name)).toEqual([
      "Löbejün Climbing",
      "Spielberg Climbing",
    ]);
    expect(board.pastTrips.map((x) => Math.abs(x.model.daysUntil))).toEqual([18, 32]);
  });

  it("is insensitive to the order the API returns trips in", () => {
    const names = (list: TripEntry[]) => {
      const board = buildTripBoard(list, TODAY);
      return [board.hero!.trip.name, ...board.pastTrips.map((x) => x.trip.name)];
    };
    const expected = ["Boys weekend", "Löbejün Climbing", "Spielberg Climbing"];

    expect(names([spielberg, lobejun, boys])).toEqual(expected);
    expect(names([boys, spielberg, lobejun])).toEqual(expected);
    expect(names([lobejun, boys, spielberg])).toEqual(expected);
  });

  it("prefers the soonest upcoming trip over any past trip for the hero", () => {
    const soon = trip("u1", "Via ferrata Italy", "2026-08-14", "2026-08-16");
    const later = trip("u2", "Autumn Frankenjura", "2026-10-02", "2026-10-04");

    const board = buildTripBoard([spielberg, later, boys, soon], TODAY);

    expect(board.hero?.trip.name).toBe("Via ferrata Italy");
    expect(board.upcomingRest.map((x) => x.trip.name)).toEqual(["Autumn Frankenjura"]);
    // Past section keeps its most-recent-first order alongside an upcoming hero.
    expect(board.pastTrips.map((x) => x.trip.name)).toEqual([
      "Boys weekend",
      "Spielberg Climbing",
    ]);
  });

  it("keeps upcoming soonest first and sinks dateless trips to the bottom", () => {
    const tbd = trip("t", "Somewhere, someday", null, null);
    const soon = trip("u1", "Via ferrata Italy", "2026-08-14", "2026-08-16");
    const later = trip("u2", "Autumn Frankenjura", "2026-10-02", "2026-10-04");

    const board = buildTripBoard([tbd, later, soon], TODAY);

    expect(board.hero?.trip.name).toBe("Via ferrata Italy");
    expect(board.upcomingRest.map((x) => x.trip.name)).toEqual([
      "Autumn Frankenjura",
      "Somewhere, someday",
    ]);
  });

  it("features an in-progress trip and leaves the upcoming list intact", () => {
    const now = trip("n", "Happening now", "2026-07-27", "2026-07-29");
    const soon = trip("u1", "Via ferrata Italy", "2026-08-14", "2026-08-16");

    const board = buildTripBoard([boys, now, soon], TODAY);

    expect(board.hero?.trip.name).toBe("Happening now");
    expect(board.current?.trip.name).toBe("Happening now");
    expect(board.upcomingRest.map((x) => x.trip.name)).toEqual(["Via ferrata Italy"]);
    expect(board.pastTrips.map((x) => x.trip.name)).toEqual(["Boys weekend"]);
  });
});
