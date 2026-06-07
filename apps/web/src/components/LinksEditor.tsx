type LinkDraft = { name: string; url: string };

/**
 * Editable list of named location links (crag, Google Maps, topo, parking…).
 * Controlled — the parent owns the array and cleans it before saving.
 */
export default function LinksEditor({
  links,
  onChange,
}: {
  links: LinkDraft[];
  onChange: (links: LinkDraft[]) => void;
}) {
  const update = (i: number, patch: Partial<LinkDraft>) =>
    onChange(links.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const remove = (i: number) => onChange(links.filter((_, idx) => idx !== i));
  const add = () => onChange([...links, { name: "", url: "" }]);

  return (
    <div className="col" style={{ gap: 8 }}>
      {links.map((l, i) => (
        <div className="row" style={{ gap: 6, alignItems: "flex-start" }} key={i}>
          <input
            value={l.name}
            onChange={(e) => update(i, { name: e.target.value })}
            placeholder="Name (e.g. Google Maps)"
            style={{ flex: 1, minWidth: 0 }}
            aria-label="Link name"
          />
          <input
            value={l.url}
            onChange={(e) => update(i, { url: e.target.value })}
            placeholder="https://…"
            inputMode="url"
            style={{ flex: 1.4, minWidth: 0 }}
            aria-label="Link URL"
          />
          <button
            type="button"
            className="th-btn th-btn--tertiary"
            onClick={() => remove(i)}
            aria-label="Remove link"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className="th-btn th-btn--secondary"
        onClick={add}
        style={{ alignSelf: "flex-start" }}
      >
        + Add link
      </button>
    </div>
  );
}
