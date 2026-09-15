import React, { useEffect, useState, useCallback, useRef } from "react";
import { Outlet, useParams, useNavigate, useLocation } from "react-router";
import { api, ApiError } from "../api";
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
import { useTripSocket } from "../lib/useTripSocket";
import IdentityFlow from "./IdentityFlow";
import TripAccountSync from "../components/TripAccountSync";
import SignInPrompt from "../components/SignInPrompt";
import {
  preferredMemberName,
  replacementForGeneratedMemberName,
  useProfile,
} from "../lib/profile";

const userKey = (tripId: string) => `climbingTrip.userId.${tripId}`;

function readNum(key: string): number | null {
  const v = localStorage.getItem(key);
  return v ? Number(v) : null;
}

type Access = "loading" | "public" | "signin" | "join" | "member";

export default function TripLayout() {
  // The URL param carries a cosmetic slug prefix (`moab-<id>`); the canonical
  // id is just the trailing 64-char hex. Everything downstream — API calls,
  // localStorage keys, context — uses this stable id, never the slug.
  const { tripId: tripParam } = useParams<{ tripId: string }>();
  const tripId = extractTripId(tripParam ?? "");
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const {
    ready: profileReady,
    profile: prefillProfile,
    accountName,
  } = useProfile();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [gear, setGear] = useState<GearContribution[]>([]);
  const [gearDeclines, setGearDeclines] = useState<GearDecline[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [pollAnswers, setPollAnswers] = useState<PollAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState<Access>("loading");
  const [currentUserId, setCurrentUserId] = useState<number | null>(() =>
    readNum(userKey(tripId))
  );

  // Lazy-identity sheet (cooperative, public trips only). `identityOpen`
  // controls visibility; `resolverRef` holds the promise resolver from the
  // in-flight ensureUser() call so the original write action resumes once the
  // visitor identifies (or dismisses).
  const [identityOpen, setIdentityOpen] = useState(false);
  const resolverRef = useRef<((id: number | null) => void) | null>(null);

  // Nudge deck (dashboard "finish your answers" card). Holds the pre-filtered
  // poll and gear-category lists while open; null means closed.
  const [questionPolls, setQuestionPolls] = useState<Poll[] | null>(null);
  const [questionCategories, setQuestionCategories] = useState<Category[]>([]);

  const loadMemberData = useCallback(async () => {
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
  }, [tripId]);

  const refresh = useCallback(async () => {
    try {
      const t = await api.getTrip(tripId);
      setTrip(t);

      if (t.public) {
        setAccess("public");
        await loadMemberData();
      } else {
        // Private: resolve membership from the server (member data would 403
        // for a non-member, so the join screen renders from the summary alone).
        const me = await api.myTripUser(tripId);
        if (me.user_id != null) {
          localStorage.setItem(userKey(tripId), String(me.user_id));
          setCurrentUserId(me.user_id);
          setAccess("member");
          await loadMemberData();
        } else {
          setAccess("join");
        }
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        // Private trip, signed out — prompt sign-in.
        setAccess("signin");
      } else {
        navigate("/", { replace: true });
      }
    }
    setLoading(false);
  }, [tripId, navigate, loadMemberData]);

  useEffect(() => {
    setLoading(true);
    setAccess("loading");
    setCurrentUserId(readNum(userKey(tripId)));
    refresh();
  }, [tripId, refresh]);

  // Extra realtime listeners: screens holding their own fetched slices (the
  // dashboard's cars/dogs/expenses/balances) register a reloader here so a
  // "changed" signal updates them too, not just the context data `refresh`
  // reloads. A ref avoids re-running the socket effect when listeners change.
  const changeListeners = useRef(new Set<() => void>());
  const subscribeToChanges = useCallback((listener: () => void) => {
    changeListeners.current.add(listener);
    return () => {
      changeListeners.current.delete(listener);
    };
  }, []);

  // Live updates: when another participant changes anything, the server pushes
  // a "changed" signal. Refetch the context data and fan out to subscribers.
  const handleRealtimeChange = useCallback(() => {
    refresh();
    changeListeners.current.forEach((listener) => listener());
  }, [refresh]);

  // Only subscribe once the viewer can read the trip.
  useTripSocket(
    tripId,
    access === "member" || access === "public",
    handleRealtimeChange
  );

  // Self-heal: clear a stored userId no longer in the roster. Skip the join
  // screen, where users is empty by design.
  useEffect(() => {
    if (loading || !currentUserId || access === "join") return;
    if (users.length === 0) return;
    const found = users.find((u) => u.id === currentUserId);
    if (!found) {
      localStorage.removeItem(userKey(tripId));
      setCurrentUserId(null);
    }
  }, [loading, currentUserId, users, tripId, access]);

  // Keep the address bar showing the trip's current, recognizable slug.
  // Bare-id links and stale slugs (after a rename) get rewritten in place.
  useEffect(() => {
    if (loading || !trip) return;
    const slug = slugify(trip.name);
    const stem = slug ? `${slug}-${tripId}` : tripId;
    if (tripParam === stem) return;
    const sub = routeLocation.pathname.endsWith("/board") ? "/board" : "";
    // Preserve the query string so a deep link (`?card=cars`) survives the
    // bare-id → slug rewrite and reaches the board.
    navigate(`/trips/${stem}${sub}${routeLocation.search}`, { replace: true });
  }, [loading, trip, tripId, tripParam, routeLocation.pathname, routeLocation.search, navigate]);

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

  // Bind the signed-in account and load the newly accessible member data.
  // Landing owns Clerk readiness and name resolution because it is the only
  // caller that starts a private join.
  const joinPrivateTrip = useCallback(async (name: string) => {
    const member = await api.joinTrip(tripId, name);
    localStorage.setItem(userKey(tripId), String(member.id));
    setCurrentUserId(member.id);
    setAccess("member");
    await loadMemberData();
  }, [tripId, loadMemberData]);

  // Repair rows created by the old private-join fallback once the affected
  // member revisits with a usable account name. Restrict this to the linked
  // current member so an intentional cooperative name is never changed.
  const nameRepairAttempted = useRef<string | null>(null);
  useEffect(() => {
    if (!profileReady || trip?.public !== false || currentUserId == null) return;
    const currentUser = users.find((u) => u.id === currentUserId);
    if (!currentUser?.linked) return;

    const replacement = replacementForGeneratedMemberName(
      currentUser.name,
      preferredMemberName(prefillProfile, accountName)
    );
    if (!replacement) return;

    const key = `${tripId}:${currentUserId}:${replacement}`;
    if (nameRepairAttempted.current === key) return;
    nameRepairAttempted.current = key;
    api
      .updateUser(tripId, currentUserId, { name: replacement })
      .then(() => refresh())
      .catch(() => {
        nameRepairAttempted.current = null;
      });
  }, [
    profileReady,
    trip,
    currentUserId,
    users,
    prefillProfile,
    accountName,
    tripId,
    refresh,
  ]);

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

  if (access === "signin") {
    return (
      <SignInPrompt
        lead="Sign in to view this trip"
        sub="This trip is private. Sign in to see it or join via the link."
      />
    );
  }

  if (loading || !trip) {
    return (
      <div className="app-shell">
        <div className="center-screen">
          <p className="muted">Loading…</p>
        </div>
      </div>
    );
  }

  const isPublic = trip.public;

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
        subscribeToChanges,
        deleteTrip,
        joinPrivateTrip,
      }}
    >
      {/* Public trips only — private-trip identity is the account itself. */}
      {isPublic && <TripAccountSync />}
      <Outlet />
      {isPublic && (
        <IdentityFlow
          open={identityOpen}
          tripId={tripId}
          users={users}
          categories={categories}
          polls={polls}
          profile={prefillProfile}
          accountName={accountName}
          setUser={setUser}
          refresh={refresh}
          onDone={resolveIdentity}
        />
      )}
      {/* Dashboard nudge deck: unanswered polls + pending gear for the member. */}
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
