// @-mention support for the announcements composer + feed. A `MentionTextarea`
// swaps in for a plain textarea: typing "@" opens an autocomplete of trip
// members and picking one inserts `@Name`. `MentionText` renders a stored body
// with those mentions highlighted (and everything else linkified as before).
//
// The source of truth for "who was mentioned" is always the text itself
// (`mentionedIds`), not a side list — so deleting a mention from the text drops
// it, and there's no stale state to reconcile on submit.
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Linkify from "./Linkify";

export type MentionMember = { id: number; name: string };

/** Escape a member name for safe embedding in a RegExp. */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A global regex matching any member as an `@Name` token, plus a name→id lookup.
 * A token must follow start-or-whitespace (so `foo@Alex` / emails don't match)
 * and not run into another letter/number (so `@Jon` ≠ member "Jonathan").
 * Alternatives are longest-first so `@Jon Snow` wins over a member "Jon".
 * Returns null when there are no named members.
 */
function buildMentionMatcher(
  members: MentionMember[],
): { re: RegExp; byName: Map<string, number> } | null {
  const named = members.filter((m) => m.name);
  if (!named.length) return null;
  const byName = new Map(named.map((m) => [m.name, m.id]));
  const alt = [...named]
    .sort((a, b) => b.name.length - a.name.length)
    .map((m) => escapeRe(m.name))
    .join("|");
  return {
    re: new RegExp(`(?<=^|\\s)@(${alt})(?![\\p{L}\\p{N}])`, "gu"),
    byName,
  };
}

/** Ids of members currently @-mentioned in `text` (deduped). */
export function mentionedIds(text: string, members: MentionMember[]): number[] {
  const matcher = buildMentionMatcher(members);
  if (!matcher) return [];
  const ids = new Set<number>();
  let m: RegExpExecArray | null;
  matcher.re.lastIndex = 0;
  while ((m = matcher.re.exec(text)) !== null) {
    const id = matcher.byName.get(m[1]);
    if (id != null) ids.add(id);
  }
  return [...ids];
}

// The active "@query" under the caret: the run after the nearest preceding "@"
// that starts at a word boundary and hasn't been closed by a newline. Returns
// null when the caret isn't inside a mention token.
function activeQuery(text: string, caret: number): { at: number; query: string } | null {
  const upto = text.slice(0, caret);
  const at = upto.lastIndexOf("@");
  if (at < 0) return null;
  if (at > 0 && !/\s/.test(text[at - 1])) return null; // must follow whitespace/start
  const query = upto.slice(at + 1);
  if (query.includes("\n")) return null;
  return { at, query };
}

interface TextareaProps {
  value: string;
  onChange: (next: string) => void;
  onMentionsChange?: (ids: number[]) => void;
  members: MentionMember[];
  className?: string;
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
}

export function MentionTextarea({
  value,
  onChange,
  onMentionsChange,
  members,
  className,
  placeholder,
  rows,
  autoFocus,
}: TextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState(0);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const pendingCaret = useRef<number | null>(null);

  // Keep the reported mention ids in sync with the text.
  useEffect(() => {
    onMentionsChange?.(mentionedIds(value, members));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, members]);

  // Restore the caret after a programmatic insert (React re-render moves it).
  useLayoutEffect(() => {
    if (pendingCaret.current != null && ref.current) {
      ref.current.selectionStart = ref.current.selectionEnd = pendingCaret.current;
      pendingCaret.current = null;
    }
  });

  const q = open ? activeQuery(value, caret) : null;
  const matches = useMemo(() => {
    if (!q) return [];
    const needle = q.query.trim().toLowerCase();
    return members
      .filter((m) => m.name.toLowerCase().includes(needle))
      .slice(0, 6);
  }, [q, members]);

  const showMenu = open && q != null && matches.length > 0;

  const sync = (el: HTMLTextAreaElement) => setCaret(el.selectionStart ?? 0);

  const pick = (m: MentionMember) => {
    const token = activeQuery(value, caret);
    if (!token) return;
    const before = value.slice(0, token.at);
    const after = value.slice(caret);
    const insert = `@${m.name} `;
    const next = `${before}${insert}${after}`;
    pendingCaret.current = before.length + insert.length;
    onChange(next);
    setOpen(false);
  };

  return (
    <div className="mention-field">
      <textarea
        ref={ref}
        className={className}
        placeholder={placeholder}
        rows={rows}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setCaret(e.target.selectionStart ?? 0);
          setOpen(true);
          setActiveIdx(0);
        }}
        onClick={(e) => sync(e.currentTarget)}
        onKeyUp={(e) => {
          // Arrow/caret moves that aren't menu navigation update the query.
          if (!["ArrowDown", "ArrowUp", "Enter"].includes(e.key)) sync(e.currentTarget);
        }}
        onKeyDown={(e) => {
          if (!showMenu) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIdx((i) => (i + 1) % matches.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIdx((i) => (i - 1 + matches.length) % matches.length);
          } else if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            pick(matches[activeIdx] ?? matches[0]);
          } else if (e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
          }
        }}
        onBlur={() => {
          // Delay so a click on a menu row registers before the menu unmounts.
          setTimeout(() => setOpen(false), 120);
        }}
      />
      {showMenu && (
        <ul className="mention-menu" role="listbox">
          {matches.map((m, i) => (
            <li key={m.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === activeIdx}
                className={"mention-menu__opt" + (i === activeIdx ? " is-active" : "")}
                // onMouseDown (not onClick) so it fires before the textarea blur.
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(m);
                }}
              >
                <span className="mention-menu__at">@</span>
                {m.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface TextProps {
  body: string;
  members: MentionMember[];
}

/** Render a message body with @-mentions of known members highlighted; the rest
 *  goes through Linkify exactly as before. */
export function MentionText({ body, members }: TextProps) {
  const parts = useMemo<ReactNode[]>(() => {
    const matcher = buildMentionMatcher(members);
    if (!matcher) return [<Linkify key="0">{body}</Linkify>];
    const out: ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    matcher.re.lastIndex = 0;
    while ((m = matcher.re.exec(body)) !== null) {
      if (m.index > last) {
        out.push(<Linkify key={last}>{body.slice(last, m.index)}</Linkify>);
      }
      out.push(
        <span className="ann-mention" key={`m${m.index}`}>
          {m[0]}
        </span>,
      );
      last = m.index + m[0].length;
    }
    if (last < body.length) out.push(<Linkify key={last}>{body.slice(last)}</Linkify>);
    return out;
  }, [body, members]);

  return <>{parts}</>;
}
