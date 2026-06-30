import React, { useEffect, useState, useCallback, useRef } from "react";
import { Outlet, useParams, useNavigate, useLocation } from "react-router";
import { api } from "../api";
import {
  TripProvider,
  type Trip,
  type User,
  type Category,
  type GearContribution,
  type GearDecline,
  type Poll,
  type PollAnswer,
} from "../context/TripContext";
import { extractTripId, slugify } from "../lib/tripUrl";
import IdentityFlow from "./IdentityFlow";
import { clerkEnabled } from "../lib/clerk";
import TripAccountSync from "../components/TripAccountSync";
import ProfileBridge from "../components/ProfileBridge";
import type { CragProfile } from "../lib/profile";

const userKey = (tripId: string) => `climbingTrip.userId.${tripId}`;

function readNum(key: string): number | null {
  const v = localStorage.getItem(key);
  return v ? Number(v) : null;
}

export default function TripLayout() {
  // The URL param carries a cosmetic slug prefix (`moab-<id>`); the canonical
  // id is just the trailing 64-char hex. Everything downstream — API calls,
  // localStorage keys, context — uses this stable id, never the slug.
  const { tripId: tripParam } = useParams<{ tripId: string }>();
  const tripId = extractTripId(tripParam ?? "");
  const navigate = useNavigate();
  const routeLocation = useLocation();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [gear, setGear] = useState<GearContribution[]>([]);
  const [gearDeclines, setGearDeclines] = useState<GearDecline[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [pollAnswers, setPollAnswers] = useState<PollAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<number | null>(() =>
    readNum(userKey(tripId))
  );

  // Lazy-identity sheet. `identityOpen` controls visibility; `resolverRef`
  // holds the promise resolver from the in-flight ensureUser() call so the
  // original write action can resume once the visitor identifies (or dismisses).
  const [identityOpen, setIdentityOpen] = useState(false);
  const resolverRef = useRef<((id: number | null) => void) | null>(null);

  // Nudge deck (dashboard "finish your answers" card). Holds the pre-filtered
  // poll and gear-category lists while open; null means closed.
  const [questionPolls, setQuestionPolls] = useState<Poll[] | null>(null);
  const [questionCategories, setQuestionCategories] = useState<Category[]>([]);

  // Signed-in member's saved kit, lifted from Clerk by ProfileBridge (gated), to
  // prefill the identify questionnaire. Null when signed out / Clerk disabled.
  const [prefillProfile, setPrefillProfile] = useState<CragProfile | null>(null);

  const refresh = useCallback(async () => {
    try {
      const t = await api.getTrip(tripId);
      setTrip(t);
      const [u, c, g, gd, p, pa] = await Promise.all([
        api.listUsers(tripId),
        api.listCategories(tripId),
        api.listGear(tripId),
        api.listGearDeclines(tripId),
        api.listPolls(tripId),
        api.listPollAnswers(tripId),
      ]);
      setUsers(u);
      setCategories(c);
      setGear(g);
      setGearDeclines(gd);
      setPolls(p);
      setPollAnswers(pa);
    } catch {
      // Trip was deleted or doesn't exist — bounce to listing
      navigate("/", { replace: true });
    }
    setLoading(false);
  }, [tripId, navigate]);

  useEffect(() => {
    setLoading(true);
    setCurrentUserId(readNum(userKey(tripId)));
    refresh();
  }, [tripId, refresh]);

  // Self-heal: if stored userId no longer exists in users list, clear it
  useEffect(() => {
    if (loading || !currentUserId) return;
    const found = users.find((u) => u.id === currentUserId);
    if (!found) {
      localStorage.removeItem(userKey(tripId));
      setCurrentUserId(null);
    }
  }, [loading, currentUserId, users, tripId]);

  // Keep the address bar showing the trip's current, recognizable slug.
  // Bare-id links and stale slugs (after a rename) get rewritten in place.
  // Lookup only ever uses the trailing id, so this is purely cosmetic and
  // never invalidates a previously shared link.
  useEffect(() => {
    if (loading || !trip) return;
    const slug = slugify(trip.name);
    const stem = slug ? `${slug}-${tripId}` : tripId;
    if (tripParam === stem) return;
    const sub = routeLocation.pathname.endsWith("/board") ? "/board" : "";
    navigate(`/trips/${stem}${sub}`, { replace: true });
  }, [loading, trip, tripId, tripParam, routeLocation.pathname, navigate]);

  // Memoized so it is stable across renders — TripAccountSync depends on it in
  // an effect, and an unstable identity would re-fire the /users/me lookup.
  const setUser = useCallback(
    (userId: number | null) => {
      if (userId == null) {
        localStorage.removeItem(userKey(tripId));
      } else {
        localStorage.setItem(userKey(tripId), String(userId));
      }
      setCurrentUserId(userId);
    },
    [tripId]
  );

  const switchUser = () => {
    localStorage.removeItem(userKey(tripId));
    setCurrentUserId(null);
  };

  const ensureUser = useCallback((): Promise<number | null> => {
    const existing = readNum(userKey(tripId));
    if (existing != null) return Promise.resolve(existing);
    return new Promise<number | null>((resolve) => {
      resolverRef.current = resolve;
      setIdentityOpen(true);
    });
  }, [tripId]);

  const openQuestions = useCallback(
    (polls: Poll[], cats: Category[] = []) => {
      // Only meaningful once we know who the user is.
      if (currentUserId == null || (polls.length === 0 && cats.length === 0))
        return;
      setQuestionCategories(cats);
      setQuestionPolls(polls);
    },
    [currentUserId]
  );

  // Resolve the pending ensureUser() promise (if any) and close the overlay.
  const resolveIdentity = (id: number | null) => {
    setIdentityOpen(false);
    const resolve = resolverRef.current;
    resolverRef.current = null;
    resolve?.(id);
  };

  const deleteTrip = async () => {
    await api.deleteTrip(tripId);
    localStorage.removeItem(userKey(tripId));
    navigate("/", { replace: true });
  };

  if (loading || !trip) {
    return (
      <div className="app-shell">
        <div className="center-screen">
          <p className="muted">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <TripProvider
      value={{
        tripId: tripId,
        trip,
        users,
        categories,
        gear,
        gearDeclines,
        polls,
        pollAnswers,
        currentUserId,
        setUser,
        switchUser,
        ensureUser,
        openQuestions,
        refresh,
        deleteTrip,
      }}
    >
      {clerkEnabled && <TripAccountSync />}
      {clerkEnabled && <ProfileBridge onProfile={setPrefillProfile} />}
      <Outlet />
      <IdentityFlow
        open={identityOpen}
        tripId={tripId}
        users={users}
        categories={categories}
        polls={polls}
        profile={prefillProfile}
        setUser={setUser}
        refresh={refresh}
        onDone={resolveIdentity}
      />
      {/* Nudge deck for the dashboard card: already-identified user,
          pre-filtered to their unanswered polls and pending gear. */}
      <IdentityFlow
        open={questionPolls != null}
        mode="questions"
        questionUserId={currentUserId}
        tripId={tripId}
        users={users}
        categories={questionCategories}
        polls={questionPolls ?? []}
        setUser={setUser}
        refresh={refresh}
        onDone={() => setQuestionPolls(null)}
      />
    </TripProvider>
  );
}
