import { useEffect, useState } from "react";
import { GEAR_CATALOG, GEAR_CATALOG_BY_SLUG } from "@cragstronauts/contract";
import {
  type CragProfile,
  type ProfileCar,
  type ProfileCompanion,
  type ProfileGear,
  type CompanionType,
} from "../../lib/profile";
import { Segmented, ToggleRow, XIcon } from "./controls";

const uid = () => crypto.randomUUID();

function SeatsInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <input
      className="pf-input pf-input--num"
      type="number"
      min={1}
      max={12}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const n = parseInt(draft, 10);
        const clamped = isNaN(n) ? 1 : Math.max(1, Math.min(12, n));
        onChange(clamped);
        setDraft(String(clamped));
      }}
    />
  );
}

const COMPANION_OPTIONS: { value: CompanionType; label: string }[] = [
  { value: "dog", label: "🐕 Dog" },
  { value: "cat", label: "🐈 Cat" },
  { value: "kid", label: "🧒 Kid" },
];

const COMPANION_EMOJI: Record<CompanionType, string> = {
  dog: "🐕",
  cat: "🐈",
  kid: "🧒",
};

interface Props {
  value: CragProfile;
  onChange: (next: CragProfile) => void;
  /** Falls back into the username field's placeholder (e.g. the Clerk name). */
  placeholderName?: string;
}

export default function GeneralTab({ value, onChange, placeholderName }: Props) {
  const patch = (p: Partial<CragProfile>) => onChange({ ...value, ...p });

  // --- Cars ---
  const addCar = () => patch({ cars: [...value.cars, { id: uid(), seats: 4 }] });
  const updateCar = (id: string, p: Partial<ProfileCar>) =>
    patch({ cars: value.cars.map((c) => (c.id === id ? { ...c, ...p } : c)) });
  const removeCar = (id: string) =>
    patch({ cars: value.cars.filter((c) => c.id !== id) });

  // --- Gear ---
  const addGear = (slug: string) =>
    patch({ gear: [...value.gear, { id: uid(), slug }] });
  const removeGear = (id: string) =>
    patch({ gear: value.gear.filter((g) => g.id !== id) });
  const setGearValue = (id: string, key: string, raw: string) =>
    patch({
      gear: value.gear.map((g) => {
        if (g.id !== id) return g;
        const values = { ...(g.values ?? {}) };
        if (raw === "") delete values[key];
        else values[key] = Number(raw);
        return { ...g, values };
      }),
    });

  // --- Companions ---
  const addCompanion = () =>
    patch({
      companions: [...value.companions, { id: uid(), type: "dog", name: "" }],
    });
  const updateCompanion = (id: string, p: Partial<ProfileCompanion>) =>
    patch({
      companions: value.companions.map((c) =>
        c.id === id ? { ...c, ...p } : c
      ),
    });
  const removeCompanion = (id: string) =>
    patch({ companions: value.companions.filter((c) => c.id !== id) });

  const [gearPickerOpen, setGearPickerOpen] = useState(false);

  return (
    <div className="pf-form">
      {/* Username */}
      <Section title="What do we call you?">
        <input
          className="pf-input"
          value={value.username ?? ""}
          placeholder={placeholderName || "Your name"}
          onChange={(e) => patch({ username: e.target.value })}
          maxLength={40}
        />
      </Section>

      {/* Diet */}
      <Section title="Dietary preference" hint="So the camp cook plans for you.">
        <Segmented
          value={value.diet}
          onChange={(diet) => patch({ diet })}
          options={[
            { value: "omnivore", label: "Omnivore" },
            { value: "vegetarian", label: "Vegetarian" },
            { value: "vegan", label: "Vegan" },
          ]}
        />
      </Section>

      {/* Skills */}
      <Section title="On the sharp end">
        <div className="pf-stack">
          <ToggleRow
            label="I can lead climb"
            checked={value.canLeadClimb ?? false}
            onChange={(canLeadClimb) => patch({ canLeadClimb })}
          />
          <ToggleRow
            label="I can lead belay"
            checked={value.canLeadBelay ?? false}
            onChange={(canLeadBelay) => patch({ canLeadBelay })}
          />
        </div>
      </Section>

      {/* Cars */}
      <Section title="Wheels" hint="Cars you could bring to share the drive.">
        <div className="pf-stack">
          {value.cars.map((car) => (
            <div key={car.id} className="pf-item">
              <div className="pf-item__head">
                <span className="pf-item__emoji" aria-hidden="true">
                  🚐
                </span>
                <span className="pf-item__title">Car</span>
                <RemoveButton onClick={() => removeCar(car.id)} label="Remove car" />
              </div>
              <div className="pf-fields">
                <label className="pf-field pf-field--grow">
                  <span className="pf-field__label">Nickname</span>
                  <input
                    className="pf-input"
                    value={car.name ?? ""}
                    placeholder="Optional"
                    onChange={(e) => updateCar(car.id, { name: e.target.value })}
                    maxLength={40}
                  />
                </label>
                <label className="pf-field">
                  <span className="pf-field__label">Seats</span>
                  <SeatsInput
                    value={car.seats}
                    onChange={(seats) => updateCar(car.id, { seats })}
                  />
                </label>
              </div>
            </div>
          ))}
          <button type="button" className="pf-add" onClick={addCar}>
            + Add a car
          </button>
        </div>
      </Section>

      {/* Gear */}
      <Section title="Your rack" hint="Predefined kit you can offer the group.">
        <div className="pf-stack">
          {value.gear.map((g) => (
            <GearRow
              key={g.id}
              gear={g}
              onValue={(key, raw) => setGearValue(g.id, key, raw)}
              onRemove={() => removeGear(g.id)}
            />
          ))}

          {gearPickerOpen ? (
            <div className="pf-picker">
              {GEAR_CATALOG.map((item) => (
                <button
                  key={item.slug}
                  type="button"
                  className="pf-chip"
                  onClick={() => addGear(item.slug)}
                >
                  <span aria-hidden="true">{item.emoji}</span> {item.label}
                </button>
              ))}
              <button
                type="button"
                className="pf-picker__done"
                onClick={() => setGearPickerOpen(false)}
              >
                Done
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="pf-add"
              onClick={() => setGearPickerOpen(true)}
            >
              + Add gear
            </button>
          )}
        </div>
      </Section>

      {/* Companions */}
      <Section title="Companions" hint="Dogs, cats, or kids coming along.">
        <div className="pf-stack">
          {value.companions.map((c) => (
            <div key={c.id} className="pf-item">
              <div className="pf-item__head">
                <span className="pf-item__emoji" aria-hidden="true">
                  {COMPANION_EMOJI[c.type]}
                </span>
                <span className="pf-item__title">Companion</span>
                <RemoveButton
                  onClick={() => removeCompanion(c.id)}
                  label="Remove companion"
                />
              </div>
              <div className="pf-fields">
                <label className="pf-field pf-field--grow">
                  <span className="pf-field__label">Name</span>
                  <input
                    className="pf-input"
                    value={c.name}
                    placeholder="Name"
                    onChange={(e) => updateCompanion(c.id, { name: e.target.value })}
                    maxLength={40}
                  />
                </label>
                <div className="pf-field">
                  <span className="pf-field__label">Type</span>
                  <Segmented
                    value={c.type}
                    onChange={(type) => updateCompanion(c.id, { type })}
                    options={COMPANION_OPTIONS}
                  />
                </div>
              </div>
            </div>
          ))}
          <button type="button" className="pf-add" onClick={addCompanion}>
            + Add a companion
          </button>
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="pf-section">
      <div className="pf-section__head">
        <h3 className="pf-section__title">{title}</h3>
        {hint && <p className="pf-section__hint">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function GearRow({
  gear,
  onValue,
  onRemove,
}: {
  gear: ProfileGear;
  onValue: (key: string, raw: string) => void;
  onRemove: () => void;
}) {
  const item = GEAR_CATALOG_BY_SLUG[gear.slug];
  if (!item) return null; // slug no longer in the catalog — skip rather than crash
  return (
    <div className="pf-item">
      <div className="pf-item__head">
        <span className="pf-item__emoji" aria-hidden="true">
          {item.emoji}
        </span>
        <span className="pf-item__title">{item.label}</span>
        <RemoveButton onClick={onRemove} label={`Remove ${item.label}`} />
      </div>
      {item.fields.length > 0 && (
        <div className="pf-fields">
          {item.fields.map((f) => (
            <label key={f.key} className="pf-field">
              <span className="pf-field__label">{f.label}</span>
              <input
                className="pf-input pf-input--num"
                type="number"
                inputMode="decimal"
                value={(gear.values?.[f.key] as number | undefined) ?? ""}
                onChange={(e) => onValue(f.key, e.target.value)}
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      className="pf-remove"
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <XIcon size={11} />
    </button>
  );
}
