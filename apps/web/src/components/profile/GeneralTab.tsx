import { useState } from "react";
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

const COMPANION_OPTIONS: { value: CompanionType; label: string }[] = [
  { value: "dog", label: "🐕 Dog" },
  { value: "cat", label: "🐈 Cat" },
  { value: "kid", label: "🧒 Kid" },
];

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
            <div key={car.id} className="pf-row">
              <span className="pf-row__emoji" aria-hidden="true">
                🚐
              </span>
              <input
                className="pf-input pf-input--grow"
                value={car.name ?? ""}
                placeholder="Nickname (optional)"
                onChange={(e) => updateCar(car.id, { name: e.target.value })}
                maxLength={40}
              />
              <label className="pf-num">
                <input
                  className="pf-input pf-input--num"
                  type="number"
                  min={1}
                  max={12}
                  value={car.seats}
                  onChange={(e) =>
                    updateCar(car.id, {
                      seats: Math.max(1, Math.min(12, Number(e.target.value) || 1)),
                    })
                  }
                />
                <span className="pf-num__unit">seats</span>
              </label>
              <RemoveButton onClick={() => removeCar(car.id)} label="Remove car" />
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
            <div key={c.id} className="pf-row pf-row--wrap">
              <Segmented
                value={c.type}
                onChange={(type) => updateCompanion(c.id, { type })}
                options={COMPANION_OPTIONS}
              />
              <input
                className="pf-input pf-input--grow"
                value={c.name}
                placeholder="Name"
                onChange={(e) => updateCompanion(c.id, { name: e.target.value })}
                maxLength={40}
              />
              <RemoveButton
                onClick={() => removeCompanion(c.id)}
                label="Remove companion"
              />
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
    <div className="pf-row pf-row--wrap">
      <span className="pf-row__emoji" aria-hidden="true">
        {item.emoji}
      </span>
      <span className="pf-row__label">{item.label}</span>
      {item.fields.map((f) => (
        <label key={f.key} className="pf-num">
          <input
            className="pf-input pf-input--num"
            type="number"
            inputMode="decimal"
            value={(gear.values?.[f.key] as number | undefined) ?? ""}
            onChange={(e) => onValue(f.key, e.target.value)}
          />
          <span className="pf-num__unit">{f.label}</span>
        </label>
      ))}
      <RemoveButton onClick={onRemove} label={`Remove ${item.label}`} />
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
