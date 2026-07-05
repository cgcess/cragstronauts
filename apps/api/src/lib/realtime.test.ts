import { describe, it, expect, vi } from "vitest";
import { fanOut, type Sendable } from "./realtime";

const OPEN = 1;
const CLOSED = 3;

describe("fanOut", () => {
  it("sends the serialized message to every open socket", () => {
    const a: Sendable = { send: vi.fn(), readyState: OPEN };
    const b: Sendable = { send: vi.fn(), readyState: OPEN };

    fanOut([a, b], { type: "changed" });

    const payload = JSON.stringify({ type: "changed" });
    expect(a.send).toHaveBeenCalledWith(payload);
    expect(b.send).toHaveBeenCalledWith(payload);
  });

  it("includes the resource tag when given", () => {
    const s: Sendable = { send: vi.fn(), readyState: OPEN };
    fanOut([s], { type: "changed", resource: "cars" });
    expect(s.send).toHaveBeenCalledWith(
      JSON.stringify({ type: "changed", resource: "cars" })
    );
  });

  it("skips sockets that are not open", () => {
    const closed: Sendable = { send: vi.fn(), readyState: CLOSED };
    fanOut([closed], { type: "changed" });
    expect(closed.send).not.toHaveBeenCalled();
  });

  it("a throwing socket does not stop the rest of the fan-out", () => {
    const dead: Sendable = {
      send: vi.fn(() => {
        throw new Error("dead");
      }),
      readyState: OPEN,
    };
    const live: Sendable = { send: vi.fn(), readyState: OPEN };

    fanOut([dead, live], { type: "changed" });

    expect(dead.send).toHaveBeenCalled();
    expect(live.send).toHaveBeenCalledWith(JSON.stringify({ type: "changed" }));
  });
});
