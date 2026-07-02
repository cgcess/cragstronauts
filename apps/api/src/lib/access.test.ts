import { describe, it, expect } from "vitest";
import { decideTripAccess, type TripAction } from "./access";

const ACTIONS: TripAction[] = ["join", "read-summary", "member"];

describe("decideTripAccess", () => {
  describe("public trips", () => {
    for (const action of ACTIONS) {
      for (const signedIn of [true, false]) {
        for (const isMember of [true, false]) {
          it(`allows ${action} when public (signedIn=${signedIn}, member=${isMember})`, () => {
            expect(
              decideTripAccess({ isPublic: true, signedIn, isMember, action })
            ).toEqual({ allow: true });
          });
        }
      }
    }
  });

  describe("private trips, signed out", () => {
    for (const action of ACTIONS) {
      it(`requires sign-in (401) for ${action}`, () => {
        expect(
          decideTripAccess({ isPublic: false, signedIn: false, isMember: false, action })
        ).toEqual({ allow: false, status: 401 });
      });
    }
  });

  describe("private trips, signed-in member", () => {
    for (const action of ACTIONS) {
      it(`allows ${action}`, () => {
        expect(
          decideTripAccess({ isPublic: false, signedIn: true, isMember: true, action })
        ).toEqual({ allow: true });
      });
    }
  });

  describe("private trips, signed-in non-member", () => {
    it("allows join", () => {
      expect(
        decideTripAccess({ isPublic: false, signedIn: true, isMember: false, action: "join" })
      ).toEqual({ allow: true });
    });

    it("allows read-summary (invite preview)", () => {
      expect(
        decideTripAccess({
          isPublic: false,
          signedIn: true,
          isMember: false,
          action: "read-summary",
        })
      ).toEqual({ allow: true });
    });

    it("forbids member-only actions (403)", () => {
      expect(
        decideTripAccess({ isPublic: false, signedIn: true, isMember: false, action: "member" })
      ).toEqual({ allow: false, status: 403 });
    });
  });
});
