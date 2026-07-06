import { describe, it, expect } from "vitest";
import { urlBase64ToUint8Array } from "./push";

describe("urlBase64ToUint8Array", () => {
  it("decodes a padded base64url string to the right bytes", () => {
    // "hello" -> base64 "aGVsbG8="
    const out = urlBase64ToUint8Array("aGVsbG8");
    expect(Array.from(out)).toEqual([104, 101, 108, 108, 111]);
  });

  it("handles base64url's - and _ substitutions", () => {
    // bytes [251, 255] -> base64 "+/8=" -> base64url "-_8"
    const out = urlBase64ToUint8Array("-_8");
    expect(Array.from(out)).toEqual([251, 255]);
  });

  it("round-trips a 65-byte VAPID-length key", () => {
    // A real application server key is 65 raw bytes. Encode one as base64url
    // (strip padding, swap +/ for -_) and confirm we decode it back exactly.
    const bytes = new Uint8Array(65);
    for (let i = 0; i < 65; i++) bytes[i] = (i * 7 + 3) % 256;
    const b64url = btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const out = urlBase64ToUint8Array(b64url);
    expect(out).toBeInstanceOf(Uint8Array);
    expect(Array.from(out)).toEqual(Array.from(bytes));
  });
});
