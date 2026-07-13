"use client";

import Modal from "./Modal";
import type { Style } from "@/lib/music";

type Props = {
  open: boolean;
  onClose: () => void;
  style: Style;
};

export default function TheoryModal({ open, onClose, style }: Props) {
  const t = style.theory;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`The ${style.name} approach`}
      subtitle={style.tagline}
    >
      <div className="flex flex-col gap-8 p-5 sm:p-6">
        {/* the four pillars */}
        <div className="grid gap-5 lg:grid-cols-2">
          <Card n="How it thinks" accent="var(--amber)">{t.approach}</Card>
          <Card n="What the voices do" accent="var(--coral)">{t.voiceLeading}</Card>
          <Card n="What to aim at when soloing" accent="var(--violet)">{t.targets}</Card>
          <Card n="The scale vocabulary" accent="var(--violet)">{t.scales}</Card>
        </div>

        {/* the devices */}
        <section>
          <h3 className="mb-1 font-serif text-2xl text-[var(--ink)]">The signature moves</h3>
          <p className="mb-4 text-sm text-[var(--muted)]">
            The devices this genre reaches for. Most of them are in the{" "}
            <span className="text-[var(--amber)]">Movements</span> templates — load one and hear it.
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            {t.devices.map((d) => (
              <div
                key={d.name}
                className="rounded-xl border border-[var(--line)] p-4"
                style={{ background: "var(--panel)" }}
              >
                <div className="font-mono text-sm text-[var(--amber)]">{d.name}</div>
                <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted)]">{d.what}</p>
              </div>
            ))}
          </div>
        </section>

        {/* every progression in the genre, with its voice-leading story */}
        <section>
          <h3 className="mb-1 font-serif text-2xl text-[var(--ink)]">
            Every {style.name} progression — and why it works
          </h3>
          <p className="mb-4 text-sm text-[var(--muted)]">
            The voice-leading reason each one lands. This is the part worth memorising.
          </p>
          <div className="flex flex-col gap-2">
            {style.progressions.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-[var(--line)] p-4"
                style={{ background: "var(--panel)" }}
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-serif text-lg text-[var(--ink)]">{p.name}</span>
                  <span className="font-mono text-[11px] text-[var(--muted)]">{p.blurb}</span>
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--ink)]">
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--coral)]">
                    movement ·{" "}
                  </span>
                  {p.movement}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Modal>
  );
}

function Card({ n, accent, children }: { n: string; accent: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl border border-[var(--line)] p-5"
      style={{ background: "var(--panel)" }}
    >
      <div
        className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em]"
        style={{ color: accent }}
      >
        {n}
      </div>
      <p className="text-[14px] leading-relaxed text-[var(--ink)]">{children}</p>
    </div>
  );
}
