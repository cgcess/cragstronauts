import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useUser } from "@clerk/clerk-react";
import { ANNOUNCEMENT_REACTIONS } from "@cragstronauts/contract";
import { api, type Announcement } from "../api";
import { useTripContext } from "../context/TripContext";
import { Button, useConfirm } from "./ui";
import Avatar from "./Avatar";
import { MentionTextarea, MentionText, type MentionMember } from "./Mentions";
import "./Announcements.css";

const REACTIONS = ANNOUNCEMENT_REACTIONS;

type Reaction = { emoji: string; user_ids: number[] };
type Reply = Announcement["replies"][number];

/** Outline smiley used as the "add a reaction" affordance. */
function SmileyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 14.5a4.5 4.5 0 0 0 7 0" />
      <path d="M9 9.5h.01M15 9.5h.01" />
    </svg>
  );
}

/** Compact relative time: "just now", "5m", "3h", "2d", else a short date. */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 45) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function Announcements() {
  const { tripId, users, currentUserId, subscribeToChanges } = useTripContext();
  const { user } = useUser();
  const confirm = useConfirm();

  const me = users.find((u) => u.id === currentUserId) ?? null;
  const isOrganizer = me?.is_organizer ?? false;

  const [items, setItems] = useState<Announcement[]>([]);
  const [body, setBody] = useState("");
  const [mentionIds, setMentionIds] = useState<number[]>([]);
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await api.listAnnouncements(tripId));
    } catch {
      /* transient; leave the last good list in place */
    }
  }, [tripId]);

  useEffect(() => {
    load();
  }, [load]);

  // Live updates: another participant posting/reacting broadcasts a change.
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(
    () => subscribeToChanges(() => loadRef.current()),
    [subscribeToChanges]
  );

  if (currentUserId == null) return null;

  const post = async () => {
    const text = body.trim();
    if (!text || posting) return;
    setPosting(true);
    setErr(null);
    try {
      await api.createAnnouncement(tripId, {
        user_id: currentUserId,
        body: text,
        author_avatar_url: user?.imageUrl ?? null,
        ...(mentionIds.length ? { mentioned_user_ids: mentionIds } : {}),
      });
      setBody("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setPosting(false);
    }
  };

  return (
    <section className="card ann">
      <div className="ann__label">Announcements</div>

      <div className="ann__composer">
        <Avatar name={me?.name ?? "You"} src={user?.imageUrl} size={36} />
        <div className="ann__composer-main">
          <MentionTextarea
            className="ann__input"
            rows={2}
            placeholder="Share an update with everyone…"
            value={body}
            onChange={setBody}
            members={users}
            onMentionsChange={setMentionIds}
          />
          {err && <div className="error-banner">{err}</div>}
          <div className="ann__composer-actions">
            <Button
              variant="primary"
              disabled={!body.trim() || posting}
              onClick={post}
            >
              {posting ? "Posting…" : "Post"}
            </Button>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="muted ann__empty">
          No announcements yet. Post the first update — everyone gets notified.
        </p>
      ) : (
        <div className="ann__feed">
          {items.map((a) => (
            <AnnouncementCard
              key={a.id}
              tripId={tripId}
              currentUserId={currentUserId}
              isOrganizer={isOrganizer}
              meName={me?.name ?? "You"}
              meAvatar={user?.imageUrl ?? null}
              members={users}
              announcement={a}
              confirm={confirm}
              onChanged={load}
              onLocalPatch={(next) =>
                setItems((prev) => prev.map((p) => (p.id === next.id ? next : p)))
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

function AnnouncementCard({
  tripId,
  currentUserId,
  isOrganizer,
  meName,
  meAvatar,
  members,
  announcement,
  confirm,
  onChanged,
  onLocalPatch,
}: {
  tripId: string;
  currentUserId: number;
  isOrganizer: boolean;
  meName: string;
  meAvatar: string | null;
  members: MentionMember[];
  announcement: Announcement;
  confirm: ReturnType<typeof useConfirm>;
  onChanged: () => Promise<void>;
  onLocalPatch: (next: Announcement) => void;
}) {
  const [replying, setReplying] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [replyMentionIds, setReplyMentionIds] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  const sendReply = async () => {
    const text = replyBody.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await api.createAnnouncement(tripId, {
        user_id: currentUserId,
        body: text,
        author_avatar_url: meAvatar,
        parent_id: announcement.id,
        ...(replyMentionIds.length ? { mentioned_user_ids: replyMentionIds } : {}),
      });
      setReplyBody("");
      setReplying(false);
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  // Toggle a reaction on the top-level post, patching just this card from the
  // response so a tap feels instant without reloading the whole feed.
  const toggleTop = async (emoji: string) => {
    const { reactions } = await api.toggleReaction(tripId, announcement.id, {
      user_id: currentUserId,
      emoji,
    });
    onLocalPatch({ ...announcement, reactions });
  };

  const toggleReply = async (reply: Reply, emoji: string) => {
    const { reactions } = await api.toggleReaction(tripId, reply.id, {
      user_id: currentUserId,
      emoji,
    });
    onLocalPatch({
      ...announcement,
      replies: announcement.replies.map((r) =>
        r.id === reply.id ? { ...r, reactions } : r
      ),
    });
  };

  const remove = async (id: number, isReply: boolean) => {
    const ok = await confirm({
      title: isReply ? "Delete reply?" : "Delete announcement?",
      message: isReply
        ? "This reply will be removed for everyone."
        : "This announcement and its replies will be removed for everyone.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    await api.deleteAnnouncement(tripId, id, currentUserId);
    await onChanged();
  };

  return (
    <article className="ann-post">
      <MessageRow
        name={announcement.author_name}
        avatar={announcement.author_avatar_url}
        createdAt={announcement.created_at}
        body={announcement.body}
        members={members}
        reactions={announcement.reactions}
        currentUserId={currentUserId}
        canDelete={isOrganizer || announcement.user_id === currentUserId}
        onToggleReaction={toggleTop}
        onDelete={() => remove(announcement.id, false)}
      />

      <div className="ann-post__thread">
        {announcement.replies.map((r) => (
          <MessageRow
            key={r.id}
            reply
            name={r.author_name}
            avatar={r.author_avatar_url}
            createdAt={r.created_at}
            body={r.body}
            members={members}
            reactions={r.reactions}
            currentUserId={currentUserId}
            canDelete={isOrganizer || r.user_id === currentUserId}
            onToggleReaction={(emoji) => toggleReply(r, emoji)}
            onDelete={() => remove(r.id, true)}
          />
        ))}

        {replying ? (
          <div className="ann-reply-composer">
            <Avatar name={meName} src={meAvatar} size={28} />
            <div className="ann-reply-composer__main">
              <MentionTextarea
                className="ann__input"
                rows={1}
                placeholder="Write a reply…"
                value={replyBody}
                onChange={setReplyBody}
                members={members}
                onMentionsChange={setReplyMentionIds}
                autoFocus
              />
              <div className="ann-reply-composer__actions">
                <Button variant="text" onClick={() => { setReplying(false); setReplyBody(""); }}>
                  Cancel
                </Button>
                <Button variant="primary" disabled={!replyBody.trim() || busy} onClick={sendReply}>
                  {busy ? "Replying…" : "Reply"}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <button type="button" className="ann-post__reply-btn" onClick={() => setReplying(true)}>
            Reply
          </button>
        )}
      </div>
    </article>
  );
}

function MessageRow({
  reply = false,
  name,
  avatar,
  createdAt,
  body,
  members,
  reactions,
  currentUserId,
  canDelete,
  onToggleReaction,
  onDelete,
}: {
  reply?: boolean;
  name: string;
  avatar: string | null;
  createdAt: string;
  body: string;
  members: MentionMember[];
  reactions: Reaction[];
  currentUserId: number;
  canDelete: boolean;
  onToggleReaction: (emoji: string) => void | Promise<void>;
  onDelete: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  // Horizontal nudge (px) that keeps the popover inside the viewport. On a
  // deep reply the add button sits far right, so a left-anchored picker would
  // spill off-screen; measure once on open and shift it back in.
  const [pickerShift, setPickerShift] = useState(0);

  const react = async (emoji: string) => {
    setPickerOpen(false);
    await onToggleReaction(emoji);
  };

  useLayoutEffect(() => {
    if (!pickerOpen) {
      setPickerShift(0);
      return;
    }
    const el = pickerRef.current;
    if (!el) return;
    const margin = 8;
    const rect = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    if (rect.right > vw - margin) setPickerShift(vw - margin - rect.right);
    else if (rect.left < margin) setPickerShift(margin - rect.left);
  }, [pickerOpen]);

  // Dismiss the reaction picker on any click outside it (or Escape).
  useEffect(() => {
    if (!pickerOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!addRef.current?.contains(e.target as Node)) setPickerOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPickerOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [pickerOpen]);

  return (
    <div className={"ann-msg" + (reply ? " ann-msg--reply" : "")}>
      <Avatar name={name} src={avatar} size={reply ? 28 : 40} />
      <div className="ann-msg__main">
        <div className="ann-msg__head">
          <span className="ann-msg__name">{name}</span>
          <span className="ann-msg__time">{timeAgo(createdAt)}</span>
          {canDelete && (
            <button
              type="button"
              className="ann-msg__del"
              aria-label="Delete"
              onClick={onDelete}
            >
              ×
            </button>
          )}
        </div>
        <div className="ann-msg__body">
          <MentionText body={body} members={members} />
        </div>
        <div className="ann-msg__reactions">
          {reactions
            .filter((r) => r.user_ids.length > 0)
            .map((r) => {
              const mine = r.user_ids.includes(currentUserId);
              return (
                <button
                  key={r.emoji}
                  type="button"
                  className={"ann-react" + (mine ? " is-mine" : "")}
                  onClick={() => react(r.emoji)}
                >
                  <span aria-hidden="true">{r.emoji}</span>
                  <span className="ann-react__count">{r.user_ids.length}</span>
                </button>
              );
            })}

          <div className="ann-react-add" ref={addRef}>
            <button
              type="button"
              className="ann-react ann-react--add"
              aria-label="Add reaction"
              aria-haspopup="menu"
              aria-expanded={pickerOpen}
              onClick={() => setPickerOpen((v) => !v)}
            >
              <SmileyIcon />
            </button>
            {pickerOpen && (
              <div
                className="ann-react-picker"
                role="menu"
                ref={pickerRef}
                style={
                  pickerShift
                    ? { transform: `translateX(${pickerShift}px)` }
                    : undefined
                }
              >
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="ann-react-picker__opt"
                    onClick={() => react(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
