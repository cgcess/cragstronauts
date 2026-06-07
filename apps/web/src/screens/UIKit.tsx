import React from "react";
import { Button, Tag } from "../components/ui";
import type { ButtonVariant, TagVariant } from "../components/ui";

/* A tiny gallery of every component in the Trailhead UI kit. Lives at
   /ui-kit. Use the floating theme toggle (bottom-left) to preview each
   piece in light, dark, and party modes. */

const BUTTON_VARIANTS: ButtonVariant[] = [
  "primary",
  "secondary",
  "tertiary",
  "text",
  "danger",
];

const TAG_VARIANTS: TagVariant[] = [
  "neutral",
  "clay",
  "moss",
  "slate",
  "ember",
  "rust",
];

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="uikit__section">
      <div className="uikit__section-head">
        <h2 className="uikit__h2">{title}</h2>
        {hint && <p className="uikit__hint">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="uikit__cell">
      <span className="uikit__label">{label}</span>
      <div className="uikit__cell-body">{children}</div>
    </div>
  );
}

export default function UIKit() {
  return (
    <div className="uikit">
      <style>{uikitCss}</style>
      <div className="uikit__inner">

      <header className="uikit__header">
        <h1 className="uikit__h1">Trailhead UI Kit</h1>
        <p className="uikit__lede">
          Every component in <code>src/components/ui</code>. Flip the floating
          toggle (bottom-left) to preview light, dark, and party modes.
        </p>
      </header>

      <Section title="Button — variants" hint="size md · the default tier set">
        <div className="uikit__grid">
          {BUTTON_VARIANTS.map((v) => (
            <Cell key={v} label={v}>
              <Button variant={v}>Button</Button>
            </Cell>
          ))}
        </div>
      </Section>

      <Section title="Button — sizes">
        <div className="uikit__grid">
          <Cell label="md (default)">
            <Button variant="primary">Continue</Button>
          </Cell>
          <Cell label="lg (hero)">
            <Button variant="primary" size="lg">Continue</Button>
          </Cell>
        </div>
      </Section>

      <Section title="Button — with icons">
        <div className="uikit__grid">
          <Cell label="leadingIcon">
            <Button variant="secondary" leadingIcon={<PlusIcon />}>Add gear</Button>
          </Cell>
          <Cell label="trailingIcon">
            <Button variant="primary" trailingIcon={<ArrowIcon />}>Open trip</Button>
          </Cell>
          <Cell label="iconOnly (md)">
            <Button variant="secondary" iconOnly aria-label="Add">
              <PlusIcon />
            </Button>
          </Cell>
          <Cell label="iconOnly (lg)">
            <Button variant="primary" iconOnly size="lg" aria-label="Add">
              <PlusIcon />
            </Button>
          </Cell>
        </div>
      </Section>

      <Section title="Button — shapes & width">
        <div className="uikit__grid">
          <Cell label="pill">
            <Button variant="secondary" pill>Logout</Button>
          </Cell>
          <Cell label="fullWidth">
            <Button variant="primary" fullWidth>Save trip</Button>
          </Cell>
        </div>
      </Section>

      <Section title="Button — disabled">
        <div className="uikit__grid">
          {BUTTON_VARIANTS.map((v) => (
            <Cell key={v} label={`${v} · disabled`}>
              <Button variant={v} disabled>Button</Button>
            </Cell>
          ))}
        </div>
      </Section>

      <Section title="Tag — variants" hint="size md · the nature palette">
        <div className="uikit__grid">
          {TAG_VARIANTS.map((v) => (
            <Cell key={v} label={v}>
              <Tag variant={v}>{v}</Tag>
            </Cell>
          ))}
        </div>
      </Section>

      <Section title="Tag — sizes, dot & mono">
        <div className="uikit__grid">
          <Cell label="md (default)">
            <Tag variant="moss">Confirmed</Tag>
          </Cell>
          <Cell label="sm">
            <Tag variant="moss" size="sm">Confirmed</Tag>
          </Cell>
          <Cell label="dot">
            <Tag variant="ember" dot>On now</Tag>
          </Cell>
          <Cell label="mono">
            <Tag variant="slate" mono>5.11a</Tag>
          </Cell>
        </div>
      </Section>
      </div>
    </div>
  );
}

const uikitCss = `
.uikit {
  height: 100vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  color: var(--text);
  position: relative;
  z-index: 1;
}
.uikit__inner {
  max-width: 920px;
  margin: 0 auto;
  padding: 48px 24px 96px;
}
.uikit__header { margin-bottom: 40px; }
.uikit__h1 {
  font-family: var(--fl-font-display, system-ui, sans-serif);
  font-weight: 800;
  font-size: 34px;
  letter-spacing: -0.01em;
  margin: 0 0 8px;
}
.uikit__lede { color: var(--text-muted); font-size: 15px; line-height: 1.5; margin: 0; max-width: 56ch; }
.uikit__lede code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.9em;
  padding: 1px 5px;
  border-radius: 6px;
  background: var(--surface-3);
}
.uikit__section { margin-bottom: 36px; }
.uikit__section-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border);
}
.uikit__h2 { font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin: 0; color: var(--text); }
.uikit__hint { font-size: 12px; color: var(--text-faint); margin: 0; }
.uikit__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 14px;
}
.uikit__cell {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px 16px;
  border-radius: 14px;
  background: var(--surface);
  border: 1px solid var(--border);
}
.uikit__cell-body { display: flex; align-items: center; min-height: 40px; }
.uikit__label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--text-faint);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
`;
