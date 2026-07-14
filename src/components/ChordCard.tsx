"use client";

import { useState } from "react";
import Piano from "./Piano";
import Fretboard from "./Fretboard";
import { playChord, playNote } from "@/lib/audio";
import type { Shape } from "@/lib/guitar";
import {
  QUALITIES,
  QUALITY_ORDER,
  noteNameFor,
  upperTensionsFor,
  type BuiltChord,
  type KeyRange,
  type QualityId,
  type WorkingChord,
} from "@/lib/music";

export type Instrument = "piano" | "guitar";

type Props = {
  chord: BuiltChord;
  range: KeyRange;
  index: number;
  total: number;
  tonicPc: number;
  instrument: Instrument;
  shapes: Shape[];
  /** the midi notes this chord actually sounds on the current instrument */
  voice: number[];
  playing: boolean;
  someoneElsePlaying: boolean;
  onChange: (patch: Partial<WorkingChord>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onOpenScales: () => void;
  onOpenSolo: () => void;
  onOpenFamily: () => void;
};

export default function ChordCard({
  chord, range, index, total, tonicPc, instrument, shapes, voice,
  playing, someoneElsePlaying, onChange, onRemove, onMove, onOpenScales, onOpenSolo, onOpenFamily,
}: Props) {
  const [pressed, setPressed] = useState(false);
  const lit = playing || pressed;

  const shape = shapes.length ? shapes[chord.shape % shapes.length] : null;

  const hit = () => {
    playChord(voice, { roll: true });
    setPressed(true);
    window.setTimeout(() => setPressed(false), 260);
  };

  const noteCount = chord.notes.filter((n) => n.role !== "bass").length;
  const cycleVariant = (d: 1 | -1) =>
    onChange({ variant: (chord.variant + d + chord.variantCount) % chord.variantCount });
  const cycleInversion = (d: 1 | -1) =>
    onChange({ inversion: (chord.inversion + d + noteCount) % noteCount });

  return (
    <div
      className={[
        "flex flex-col gap-4 rounded-2xl border p-4 transition-[box-shadow,border-color] duration-300 lg:flex-row lg:p-5",
        lit
          ? "border-[var(--amber)] shadow-[0_0_0_1px_var(--amber),0_18px_50px_-24px_rgba(240,180,94,0.5)]"
          : "border-[var(--line)]",
      ].join(" ")}
      style={{ background: "var(--panel)" }}
    >
      {/* ---------- left: identity + controls ---------- */}
      <div className="flex w-full shrink-0 flex-col gap-3 lg:w-[290px]">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-[var(--muted)] tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="font-mono text-xs tracking-[0.12em] text-[var(--amber)]">{chord.roman}</span>
            </div>
            <button
              type="button"
              onClick={hit}
              title="Play this chord"
              className="mt-1 truncate rounded font-serif text-3xl leading-none text-[var(--ink)] transition hover:text-[var(--coral)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]"
              style={{ fontOpticalSizing: "auto" }}
            >
              {chord.symbol}
            </button>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <IconBtn label="Move left" disabled={index === 0} onClick={() => onMove(-1)}>◀</IconBtn>
            <IconBtn label="Move right" disabled={index === total - 1} onClick={() => onMove(1)}>▶</IconBtn>
            <IconBtn label="Remove chord" onClick={onRemove} danger>✕</IconBtn>
          </div>
        </div>

        {/* the whole chord, on demand. The keys play single notes now, so this
            needs to be its own obvious control rather than a corner overlay. */}
        <button
          type="button"
          onClick={hit}
          className={[
            "flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition",
            lit
              ? "bg-[var(--amber)] text-black"
              : "bg-[var(--amber)]/10 text-[var(--amber)] ring-1 ring-[var(--amber)]/40 hover:bg-[var(--amber)]/20",
          ].join(" ")}
        >
          ▶ Hear chord
        </button>

        {/* note chips — the voicing on whichever instrument you're looking at */}
        <div className="flex flex-wrap gap-1.5">
          {(instrument === "guitar" && shape
            ? [...shape.dots].sort((a, b) => a.string - b.string).map((d) => ({ name: d.name, role: d.role }))
            : [...chord.notes].sort((a, b) => a.midi - b.midi).map((n) => ({ name: n.name, role: n.role }))
          ).map((n, i) => (
            <span
              key={i}
              className={[
                "rounded-md px-1.5 py-0.5 font-mono text-[11px] ring-1",
                n.role === "bass"
                  ? "bg-[var(--violet)]/15 text-[var(--violet)] ring-[var(--violet)]/30"
                  : n.role === "upper"
                    ? "bg-[var(--teal)]/15 text-[var(--teal)] ring-[var(--teal)]/30"
                    : n.role === "root"
                      ? "bg-[var(--coral)]/15 text-[var(--coral)] ring-[var(--coral)]/30"
                      : "bg-white/5 text-[var(--muted)] ring-white/10",
              ].join(" ")}
            >
              {n.name}
            </span>
          ))}
        </div>

        {/* controls */}
        <div className="grid grid-cols-2 gap-2 border-t border-[var(--line)] pt-3">
          <Field label="Root">
            <select
              value={chord.rootPc}
              onChange={(e) => onChange({ rootPc: Number(e.target.value) })}
              className={selectCls} aria-label="Chord root"
            >
              {Array.from({ length: 12 }, (_, pc) => (
                <option key={pc} value={pc}>{noteNameFor(pc, tonicPc)}</option>
              ))}
            </select>
          </Field>

          <Field label="Quality">
            <select
              value={chord.quality}
              onChange={(e) => onChange({ quality: e.target.value as QualityId, variant: 0, inversion: 0, scale: null })}
              className={selectCls} aria-label="Chord quality"
            >
              {QUALITY_ORDER.map((q) => (
                <option key={q} value={q}>{QUALITIES[q].label}</option>
              ))}
            </select>
          </Field>

          {instrument === "piano" ? (
            <>
              <div className="col-span-2">
                <Field label={`Voicing · ${chord.variant + 1}/${chord.variantCount}`}>
                  <Stepper
                    onPrev={() => cycleVariant(-1)}
                    onNext={() => cycleVariant(1)}
                    value={chord.variantName}
                    what="voicing"
                  />
                </Field>
              </div>
              <Field label="Inversion">
                <Stepper
                  onPrev={() => cycleInversion(-1)}
                  onNext={() => cycleInversion(1)}
                  value={chord.inversion === 0 ? "Root pos." : `${ordinal(chord.inversion)} inv.`}
                  what="inversion"
                />
              </Field>
            </>
          ) : (
            <div className="col-span-2">
              <Field
                label={
                  shape
                    ? `Grip · ${chord.shape % shapes.length + 1}/${shapes.length} · fret ${shape.minFret}–${shape.maxFret}`
                    : "Grip"
                }
              >
                {shape ? (
                  <Stepper
                    onPrev={() => onChange({ shape: (chord.shape - 1 + shapes.length) % shapes.length })}
                    onNext={() => onChange({ shape: (chord.shape + 1) % shapes.length })}
                    value={shape.family}
                    what="grip"
                  />
                ) : (
                  <span className="font-mono text-xs text-[var(--muted)]">no playable grip</span>
                )}
              </Field>
            </div>
          )}

          <Field label="Bass (slash)">
            <select
              value={chord.bass === null ? "" : chord.bass}
              onChange={(e) => onChange({ bass: e.target.value === "" ? null : Number(e.target.value) })}
              className={selectCls} aria-label="Slash bass note"
            >
              <option value="">— none —</option>
              {Array.from({ length: 12 }, (_, pc) => (
                <option key={pc} value={pc}>
                  /{noteNameFor(pc, tonicPc)}
                </option>
              ))}
            </select>
          </Field>

          <div className="col-span-2">
            <Field label="Upper structure — stack a triad on top">
              <select
                value={chord.upper === null ? "" : chord.upper}
                onChange={(e) => onChange({ upper: e.target.value === "" ? null : Number(e.target.value) })}
                className={selectCls}
                aria-label="Upper structure triad"
              >
                <option value="">— none —</option>
                {Array.from({ length: 12 }, (_, pc) => (
                  <option key={pc} value={pc}>
                    {noteNameFor(pc, tonicPc)} triad → {upperTensionsFor(chord.rootPc, pc, chord.quality).join(" ")}
                  </option>
                ))}
              </select>
            </Field>
            {chord.upperName && (
              <p className="mt-1.5 text-[11px] leading-snug text-[var(--teal)]">
                {chord.upperName} triad over {chord.rootName} adds{" "}
                <span className="font-mono">{chord.upperTensions.join(" · ")}</span> — three tensions
                in one shape, without thinking about any of them.
              </p>
            )}
          </div>

          <div className="col-span-2">
            <Field label="Scale to play over it">
              <div className="flex gap-2">
                <select
                  value={chord.scale === null ? "" : chord.scale}
                  onChange={(e) => onChange({ scale: e.target.value === "" ? null : Number(e.target.value) })}
                  className={selectCls} aria-label="Scale overlay"
                >
                  <option value="">— hide scale —</option>
                  {chord.scaleOptions.map((s, i) => (
                    <option key={i} value={i}>{s.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={onOpenScales}
                  title="See the scale on the keyboard"
                  className="shrink-0 rounded-lg px-3 py-1.5 font-mono text-xs text-[var(--violet)] ring-1 ring-[var(--violet)]/40 transition hover:bg-[var(--violet)]/15"
                >
                  ⤢ View
                </button>
              </div>
            </Field>
            {chord.scaleName && (
              <p className="mt-1.5 text-[11px] leading-snug text-[var(--muted)]">
                {chord.scaleOptions[chord.scale!].note}
              </p>
            )}
          </div>

          <div className="col-span-2">
            <button
              type="button"
              onClick={onOpenFamily}
              className="w-full rounded-lg bg-[var(--violet)]/10 px-3 py-2 font-mono text-xs text-[var(--violet)] ring-1 ring-[var(--violet)]/40 transition hover:bg-[var(--violet)]/20"
            >
              ◇ Getting here — its ii–V, family &amp; approaches
            </button>
          </div>

          <div className="col-span-2">
            <button
              type="button"
              onClick={onOpenSolo}
              className="w-full rounded-lg bg-[var(--amber)]/10 px-3 py-2 font-mono text-xs text-[var(--amber)] ring-1 ring-[var(--amber)]/40 transition hover:bg-[var(--amber)]/20"
            >
              ♪ Solo over this chord — enclosures &amp; targets
            </button>
          </div>
        </div>
      </div>

      {/* ---------- right: the instrument. Every key/fret is playable. ---------- */}
      <div className="relative min-w-0 flex-1 rounded-xl bg-[#0b0910] p-3 ring-1 ring-black/40">
        <span className="absolute top-2 right-3 z-10 font-mono text-[10px] text-[var(--muted)]">
          click a key to hear one note
        </span>

        {instrument === "piano" ? (
          <Piano
            range={range} notes={chord.notes} scalePcs={chord.scalePcs}
            dim={someoneElsePlaying} onNote={playNote}
          />
        ) : shape ? (
          <Fretboard dots={shape.dots} showMutes dim={someoneElsePlaying} onNote={playNote} />
        ) : (
          <div className="flex h-24 items-center justify-center font-mono text-xs text-[var(--muted)]">
            no playable grip for this chord
          </div>
        )}
      </div>
    </div>
  );
}

const ordinal = (n: number) => ["Root", "1st", "2nd", "3rd", "4th", "5th", "6th"][n] ?? `${n}th`;

const selectCls =
  "w-full appearance-none rounded-lg bg-white/[0.03] px-2.5 py-1.5 font-mono text-sm text-[var(--ink)] ring-1 ring-[var(--line-bright)] focus:outline-none focus:ring-2 focus:ring-[var(--amber)]";

function Stepper({
  onPrev, onNext, value, what,
}: { onPrev: () => void; onNext: () => void; value: string; what: string }) {
  const btn = "px-2.5 py-1.5 font-mono text-xs text-[var(--muted)] transition hover:bg-white/10 hover:text-[var(--ink)]";
  return (
    <div className="flex items-stretch overflow-hidden rounded-lg ring-1 ring-[var(--line-bright)]">
      <button type="button" onClick={onPrev} className={btn} aria-label={`Previous ${what}`}>◀</button>
      <span className="flex flex-1 items-center justify-center bg-white/[0.03] px-1 py-1.5 text-center font-mono text-[13px] text-[var(--ink)]">
        {value}
      </span>
      <button type="button" onClick={onNext} className={btn} aria-label={`Next ${what}`}>▶</button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}

function IconBtn({
  children, label, onClick, disabled, danger,
}: {
  children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; danger?: boolean;
}) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label}
      className={[
        "flex h-7 w-7 items-center justify-center rounded-md text-xs transition disabled:pointer-events-none disabled:opacity-25",
        danger
          ? "text-[var(--muted)] hover:bg-[var(--coral)]/20 hover:text-[var(--coral)]"
          : "text-[var(--muted)] hover:bg-white/10 hover:text-[var(--ink)]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
