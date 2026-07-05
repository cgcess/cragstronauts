import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Env } from "../types";

vi.mock("@clerk/backend", () => ({
  verifyToken: vi.fn(),
}));

import { verifyToken } from "@clerk/backend";
import { resolveAccountFromToken } from "./auth";

const env = { CLERK_SECRET_KEY: "sk_test" } as Env;
const mockVerify = vi.mocked(verifyToken);

describe("resolveAccountFromToken", () => {
  beforeEach(() => {
    mockVerify.mockReset();
  });

  it("returns null for a null token without calling verifyToken", async () => {
    expect(await resolveAccountFromToken(env, null)).toBeNull();
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it("returns the account id (payload.sub) for a valid token", async () => {
    mockVerify.mockResolvedValue({ sub: "user_123" } as never);
    expect(await resolveAccountFromToken(env, "good")).toBe("user_123");
    expect(mockVerify).toHaveBeenCalledWith("good", { secretKey: "sk_test" });
  });

  it("returns null when the token is invalid (verifyToken throws)", async () => {
    mockVerify.mockRejectedValue(new Error("bad token"));
    expect(await resolveAccountFromToken(env, "garbage")).toBeNull();
  });

  it("returns null when the payload has no sub", async () => {
    mockVerify.mockResolvedValue({} as never);
    expect(await resolveAccountFromToken(env, "nosub")).toBeNull();
  });
});
