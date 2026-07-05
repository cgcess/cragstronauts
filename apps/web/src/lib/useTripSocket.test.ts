import { describe, it, expect, vi, afterEach } from "vitest";
import { nextBackoff, makeDebounce } from "./useTripSocket";

describe("nextBackoff", () => {
  it("doubles from 1s and caps at 30s", () => {
    expect(nextBackoff(0)).toBe(1000);
    expect(nextBackoff(1)).toBe(2000);
    expect(nextBackoff(2)).toBe(4000);
    expect(nextBackoff(3)).toBe(8000);
    expect(nextBackoff(4)).toBe(16000);
    // 32s would exceed the cap.
    expect(nextBackoff(5)).toBe(30000);
    expect(nextBackoff(20)).toBe(30000);
  });
});

describe("makeDebounce", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("collapses a burst into one trailing call", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = makeDebounce(fn, 250);

    d.call();
    d.call();
    d.call();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(250);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("fires again for a later, separate burst", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = makeDebounce(fn, 100);

    d.call();
    vi.advanceTimersByTime(100);
    d.call();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("cancel prevents a pending call", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = makeDebounce(fn, 100);

    d.call();
    d.cancel();
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
  });
});
