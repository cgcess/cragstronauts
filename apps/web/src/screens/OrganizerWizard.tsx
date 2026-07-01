import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Navigate, useNavigate } from "react-router";
import { useUser } from "@clerk/clerk-react";
import { api } from "../api";
import { tripPath } from "../lib/tripUrl";
import { cleanLinks } from "../lib/links";
import LinksEditor from "../components/LinksEditor";
import DateRangePicker from "../components/DateRangePicker";
import { Button } from "../components/ui";
import ProfileBridge from "../components/ProfileBridge";
import type { CragProfile } from "../lib/profile";
import { GEAR_CATALOG } from "@cragstronauts/contract";

interface CategoryField {
  key: string;
  label: string;
  type: string;
}

interface CategoryDraft {
  name: string;
  fields: CategoryField[];
  summary_mode: "people" | "total";
  // Canonical catalog slug when this draft came from a preset; lets a member's
  // saved profile kit match this category at join time. Undefined = custom.
  catalog_key?: string;
}

interface GeoResult {
  name: string;
  admin1?: string;
  country_code?: string;
  latitude: number;
  longitude: number;
}

const defaultCategories: CategoryDraft[] = [
  {
    name: "Rope",
    fields: [
      { key: "length", label: "Length (m)", type: "number" },
      { key: "diameter", label: "Diameter (mm)", type: "number" },
    ],
    summary_mode: "total",
    catalog_key: "rope",
  },
  {
    name: "Quickdraws",
    fields: [{ key: "count", label: "How many", type: "number" }],
    summary_mode: "total",
    catalog_key: "quickdraws",
  },
];

const STEP_TITLES = [
  "Plan the climb",
  "Pack the rack",
  "Sign on as belayer-in-chief",
];
const STEP_TAGS = [
  "Base camp · 1 of 3",
  "Gear locker · 2 of 3",
  "Rope captain · 3 of 3",
];

function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoToDate(iso: string | undefined): Date | undefined {
  if (!iso) return undefined;
  return new Date(`${iso}T00:00:00`);
}

function todayLocal(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const EASE_OUT = [0.23, 1, 0.32, 1];

const userKey = (tripId: string) => `climbingTrip.userId.${tripId}`;

function AuthGate() {
  const { isSignedIn, isLoaded } = useUser();
  if (!isLoaded) return null;
  if (!isSignedIn) return <Navigate to="/" replace />;
  return <OrganizerWizardInner />;
}

export default function OrganizerWizard() {
  if (clerkEnabled) return <AuthGate />;
  return <OrganizerWizardInner />;
}

function OrganizerWizardInner() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [pinLat, setPinLat] = useState<number | null>(null);
  const [pinLon, setPinLon] = useState<number | null>(null);
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);
  const [links, setLinks] = useState<{ name: string; url: string }[]>([]);
  const [geoResults, setGeoResults] = useState<GeoResult[]>([]);
  const [geoSearching, setGeoSearching] = useState(false);
  const [geoSearched, setGeoSearched] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [accomType, setAccomType] = useState("campsite");
  const [accomDetails, setAccomDetails] = useState("");
  const [notes, setNotes] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [signature, setSignature] = useState("");
  const [signatureTouched, setSignatureTouched] = useState(false);
  const [categories, setCategories] = useState<CategoryDraft[]>(defaultCategories);
  const [organizerName, setOrganizerName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdTripUrl, setCreatedTripUrl] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Signed-in organizer: their name is already known (saved username, else their
  // account/Google name), lifted by ProfileBridge below. Prefill it instead of
  // asking them to type it — same idea as the join flow. Runs once when the
  // profile arrives and leaves a typed value alone; the signature mirrors it
  // until the organizer edits the sign-off themselves.
  const [memberProfile, setMemberProfile] = useState<CragProfile | null>(null);
  const [accountName, setAccountName] = useState<string | null>(null);
  const memberName =
    memberProfile?.username?.trim() || accountName?.trim() || "";
  const namePrefilled = useRef(false);
  useEffect(() => {
    if (namePrefilled.current || !memberName) return;
    namePrefilled.current = true;
    setOrganizerName((cur) => (cur.trim() ? cur : memberName));
    setSignature((cur) => (cur.trim() || signatureTouched ? cur : memberName));
  }, [memberName, signatureTouched]);

  const reduceMotion = useReducedMotion();
  const today = useMemo(todayLocal, []);

  const range = useMemo(
    () => ({ from: isoToDate(startDate || undefined), to: isoToDate(endDate || undefined) }),
    [startDate, endDate],
  );
  const onRangeChange = (r: { from?: Date; to?: Date } | undefined) => {
    setStartDate(r?.from ? toLocalISO(r.from) : "");
    setEndDate(r?.to ? toLocalISO(r.to) : "");
  };

  const labelForGeo = (r: GeoResult) =>
    [r.name, r.admin1, r.country_code].filter(Boolean).join(", ");

  const geoSearch = async () => {
    if (!location.trim()) return;
    setGeoSearching(true);
    setGeoSearched(false);
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        location.trim(),
      )}&count=6&language=en&format=json`;
      const r = await fetch(url);
      const d = (await r.json()) as { results?: GeoResult[] };
      setGeoResults(d.results || []);
    } catch {
      setGeoResults([]);
    } finally {
      setGeoSearched(true);
      setGeoSearching(false);
    }
  };

  const pickPlace = (r: GeoResult) => {
    setPinLat(r.latitude);
    setPinLon(r.longitude);
    setPlaceLabel(labelForGeo(r));
    setGeoResults([]);
    setGeoSearched(false);
  };

  const clearPin = () => {
    setPinLat(null);
    setPinLon(null);
    setPlaceLabel(null);
  };

  // Dates are valid if: both empty, or start <= end
  const datesValid = !startDate || !endDate || startDate <= endDate;

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.createTrip({
        name: name.trim(),
        location: location.trim(),
        start_date: startDate || null,
        end_date: endDate || null,
        accommodation_type: accomType,
        accommodation_details: accomDetails.trim() || null,
        notes: notes.trim() || null,
        latitude: pinLat,
        longitude: pinLon,
        place_label: placeLabel,
        links: cleanLinks(links),
        welcome_message: welcomeMessage.trim(),
        signature: signature.trim(),
        organizer_name: organizerName.trim(),
        gear_categories: categories
          .filter((c) => c.name.trim())
          .map((c) => ({
            name: c.name.trim(),
            fields: c.fields.filter((f) => f.key.trim() && f.label.trim()),
            summary_mode: c.summary_mode,
            catalog_key: c.catalog_key ?? null,
          })),
      });
      localStorage.setItem(userKey(res.trip_id), String(res.organizer_user_id));
      const path = tripPath(name.trim(), res.trip_id);
      setCreatedTripUrl(window.location.origin + path);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const stagger = reduceMotion
    ? { hidden: {}, show: {} }
    : {
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: { staggerChildren: 0.06, delayChildren: 0.08 },
        },
      };
  const item = reduceMotion
    ? { hidden: {}, show: {} }
    : {
        hidden: { opacity: 0, y: 12 },
        show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE_OUT } },
      };

  return (
    <div className="app-shell">
      <ProfileBridge
        onProfile={setMemberProfile}
        onAccountName={setAccountName}
      />
      <div className="content">
        <div className="column">
        {step < 3 && (
          <>
            <motion.div
              className="row between"
              initial={reduceMotion ? false : { opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, ease: EASE_OUT }}
            >
              <div className="h1">{STEP_TITLES[step]}</div>
              <Button variant="secondary" pill onClick={() => navigate("/")}>
                Cancel
              </Button>
            </motion.div>
            <motion.p
              className="step-tag"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.32, delay: 0.06, ease: EASE_OUT }}
              key={`tag-${step}`}
            >
              {STEP_TAGS[step]}
            </motion.p>
          </>
        )}

        {error && <div className="error-banner">{error}</div>}

        <AnimatePresence mode="wait" initial={false}>
          {step === 0 && (
            <motion.div
              key="step-0"
              className="col"
              variants={stagger}
              initial="hidden"
              animate="show"
              exit={reduceMotion ? undefined : { opacity: 0, x: -24, transition: { duration: 0.2 } }}
            >
              <motion.div variants={item}>
                <label>What's the trip called? *</label>
                <input
                  placeholder="e.g. Spring send mission"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </motion.div>
              <motion.div variants={item}>
                <label>Where are we climbing? *</label>
                <div className="row" style={{ gap: 6 }}>
                  <input
                    placeholder="e.g. Yosemite Valley"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        geoSearch();
                      }
                    }}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="th-btn th-btn--secondary"
                    onClick={geoSearch}
                    disabled={geoSearching || !location.trim()}
                  >
                    {geoSearching ? "…" : "Find"}
                  </button>
                </div>

                {placeLabel ? (
                  <div className="list-item" style={{ marginTop: 8 }}>
                    <span>📍 {placeLabel}</span>
                    <button type="button" className="th-btn th-btn--tertiary" onClick={clearPin}>
                      Clear
                    </button>
                  </div>
                ) : (
                  <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    Search and pin a place to load the weather forecast.
                    Optional — you can set it later.
                  </p>
                )}

                {geoResults.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    {geoResults.map((r, i) => (
                      <div className="list-item" key={i}>
                        <span>{labelForGeo(r)}</span>
                        <button
                          type="button"
                          className="th-btn th-btn--tertiary"
                          onClick={() => pickPlace(r)}
                        >
                          Pin
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {geoSearched && geoResults.length === 0 && !placeLabel && (
                  <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                    No matches — you can still create the trip and pin the exact
                    spot later.
                  </p>
                )}
              </motion.div>

              <motion.div variants={item}>
                <label>Useful links</label>
                <LinksEditor links={links} onChange={setLinks} />
                <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  Crag page, Google Maps, topo, parking… Optional.
                </p>
              </motion.div>

              <motion.div variants={item}>
                <label>When</label>
                <DateRangePicker
                  value={range}
                  onChange={onRangeChange}
                  minDate={today}
                />
              </motion.div>

              <motion.div variants={item}>
                <label>Where do we sleep?</label>
                <select
                  value={accomType}
                  onChange={(e) => setAccomType(e.target.value)}
                >
                  <option value="campsite">Campsite</option>
                  <option value="airbnb">Airbnb</option>
                  <option value="hotel">Hotel</option>
                  <option value="hut">Hut / Refuge</option>
                  <option value="other">Other</option>
                </select>
              </motion.div>
              <motion.div variants={item}>
                <label>Drop the address (or a link)</label>
                <input
                  placeholder="Name, address, link…"
                  value={accomDetails}
                  onChange={(e) => setAccomDetails(e.target.value)}
                />
              </motion.div>
              <motion.div variants={item}>
                <label>Field notes (optional)</label>
                <textarea
                  rows={3}
                  placeholder="Approach, beta, who's bringing the espresso…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </motion.div>
              <motion.button
                variants={item}
                className="th-btn th-btn--primary th-btn--full"
                disabled={!name.trim() || !location.trim() || !datesValid}
                onClick={() => setStep(1)}
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              >
                Next · Pack the rack →
              </motion.button>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="step-1"
              className="col"
              variants={stagger}
              initial="hidden"
              animate="show"
              exit={reduceMotion ? undefined : { opacity: 0, x: -24, transition: { duration: 0.2 } }}
            >
              <motion.p variants={item} className="muted">
                What kit are we asking each climber to bring? Add as many
                categories as you need — ropes, draws, stove, snacks…
              </motion.p>
              {categories.map((cat, ci) => (
                <motion.div className="card" key={ci} variants={item}>
                  <div className="row between">
                    <input
                      value={cat.name}
                      placeholder="Category name"
                      onChange={(e) => {
                        const next = [...categories];
                        next[ci] = { ...cat, name: e.target.value };
                        setCategories(next);
                      }}
                    />
                    <button
                      className="th-btn th-btn--tertiary"
                      onClick={() =>
                        setCategories(categories.filter((_, i) => i !== ci))
                      }
                    >
                      Remove
                    </button>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <label>Fields to ask</label>
                    {cat.fields.map((f, fi) => (
                      <div className="field-builder-row" key={fi}>
                        <input
                          placeholder="Label (e.g. Length)"
                          value={f.label}
                          onChange={(e) => {
                            const next = [...categories];
                            const fields = [...cat.fields];
                            fields[fi] = {
                              ...f,
                              label: e.target.value,
                              key:
                                f.key ||
                                e.target.value
                                  .toLowerCase()
                                  .replace(/\s+/g, "_"),
                            };
                            next[ci] = { ...cat, fields };
                            setCategories(next);
                          }}
                        />
                        <select
                          value={f.type}
                          onChange={(e) => {
                            const next = [...categories];
                            const fields = [...cat.fields];
                            fields[fi] = { ...f, type: e.target.value };
                            next[ci] = { ...cat, fields };
                            setCategories(next);
                          }}
                        >
                          <option value="text">Text</option>
                          <option value="number">Number</option>
                        </select>
                        <button
                          className="th-btn th-btn--tertiary th-btn--icon th-btn--sm"
                          aria-label="Remove field"
                          onClick={() => {
                            const next = [...categories];
                            next[ci] = {
                              ...cat,
                              fields: cat.fields.filter((_, i) => i !== fi),
                            };
                            setCategories(next);
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <button
                      className="th-btn th-btn--secondary"
                      onClick={() => {
                        const next = [...categories];
                        next[ci] = {
                          ...cat,
                          fields: [
                            ...cat.fields,
                            { key: "", label: "", type: "text" },
                          ],
                        };
                        setCategories(next);
                      }}
                    >
                      + Add field
                    </button>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <label>Summary shows</label>
                    <select
                      value={cat.summary_mode}
                      onChange={(e) => {
                        const next = [...categories];
                        next[ci] = { ...cat, summary_mode: e.target.value as "people" | "total" };
                        setCategories(next);
                      }}
                    >
                      <option value="people">Number of people</option>
                      <option value="total">Total items</option>
                    </select>
                  </div>
                </motion.div>
              ))}
              {GEAR_CATALOG.some(
                (g) => !categories.some((c) => c.catalog_key === g.slug)
              ) && (
                <motion.div
                  variants={item}
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  <span className="muted">Quick-add common gear</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {GEAR_CATALOG.filter(
                      (g) => !categories.some((c) => c.catalog_key === g.slug)
                    ).map((g) => (
                      <button
                        key={g.slug}
                        type="button"
                        className="th-btn th-btn--secondary th-btn--pill"
                        style={{ minHeight: 0, padding: "8px 14px" }}
                        onClick={() =>
                          setCategories([
                            ...categories,
                            {
                              name: g.label,
                              fields: g.fields.map((f) => ({ ...f })),
                              summary_mode: "total",
                              catalog_key: g.slug,
                            },
                          ])
                        }
                      >
                        {g.emoji} {g.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
              <motion.button
                variants={item}
                className="th-btn th-btn--secondary"
                onClick={() =>
                  setCategories([...categories, { name: "", fields: [], summary_mode: "people" }])
                }
              >
                + Add category
              </motion.button>
              <motion.div variants={item} className="row" style={{ marginTop: 10 }}>
                <button className="th-btn th-btn--secondary" onClick={() => setStep(0)}>
                  Back
                </button>
                <motion.button
                  className="th-btn th-btn--primary"
                  onClick={() => setStep(2)}
                  style={{ flex: 1 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                >
                  Next · Sign on →
                </motion.button>
              </motion.div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step-2"
              className="col"
              variants={stagger}
              initial="hidden"
              animate="show"
              exit={reduceMotion ? undefined : { opacity: 0, x: -24, transition: { duration: 0.2 } }}
            >
              <motion.p variants={item} className="muted">
                You&apos;re the rope captain — the trip lives on your account.
                What should the squad call you?
              </motion.p>
              <motion.div variants={item}>
                <label>Your name *</label>
                <input
                  placeholder="Your name"
                  value={organizerName}
                  onChange={(e) => {
                    setOrganizerName(e.target.value);
                    if (!signatureTouched) setSignature(e.target.value);
                  }}
                />
              </motion.div>
              <motion.div variants={item}>
                <label>The welcome message *</label>
                <textarea
                  rows={4}
                  placeholder={"Hey crew! Booked us a Grillh\u00fctte right by the crag for the weekend \ud83e\uddd7 Bring your gear and an appetite \u2014 we'll fire up the BBQ on Saturday night. Tap below to join and let's send it!"}
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                />
                <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  The first thing people see when they open the link. Supports
                  Markdown — bold, lists, headings, and links.
                </p>
              </motion.div>
              <motion.div variants={item}>
                <label>Sign off as *</label>
                <input
                  placeholder="e.g. Juan & Lovely Girl"
                  value={signature}
                  onChange={(e) => {
                    setSignature(e.target.value);
                    setSignatureTouched(true);
                  }}
                />
                <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  Shown after the sign-off on your welcome message.
                </p>
              </motion.div>
              <motion.div variants={item} className="row">
                <button className="th-btn th-btn--secondary" onClick={() => setStep(1)}>
                  Back
                </button>
                <motion.button
                  className="th-btn th-btn--primary"
                  disabled={
                    !organizerName.trim() ||
                    !welcomeMessage.trim() ||
                    !signature.trim() ||
                    submitting
                  }
                  onClick={submit}
                  style={{ flex: 1 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                >
                  {submitting ? "Pitching the tent…" : "Send it →"}
                </motion.button>
              </motion.div>
            </motion.div>
          )}
          {step === 3 && createdTripUrl && (
            <motion.div
              key="step-3"
              className="col"
              variants={stagger}
              initial="hidden"
              animate="show"
            >
              <motion.div variants={item} className="h1" style={{ textAlign: "center" }}>
                Trip created!
              </motion.div>
              <motion.div variants={item} className="card" style={{ textAlign: "center" }}>
                <p style={{ marginBottom: 12 }}>
                  <strong>Save this link</strong> — it's the only way back to
                  your trip. Bookmark it or send it to yourself before sharing
                  with the crew.
                </p>
                <input
                  readOnly
                  value={createdTripUrl}
                  onFocus={(e) => e.target.select()}
                  style={{ textAlign: "center", marginBottom: 12 }}
                />
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => {
                    navigator.clipboard.writeText(createdTripUrl);
                    setLinkCopied(true);
                    setTimeout(() => setLinkCopied(false), 2000);
                  }}
                >
                  {linkCopied ? "Copied!" : "Copy link"}
                </Button>
              </motion.div>
              <motion.div variants={item}>
                <Button
                  variant="primary"
                  fullWidth
                  onClick={() => navigate(createdTripUrl.replace(window.location.origin, "") + "/board", { replace: true })}
                >
                  Go to trip →
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
