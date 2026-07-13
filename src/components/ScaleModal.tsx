"use client";

import { useState } from "react";
import Modal from "./Modal";
import Piano from "./Piano";
import Fretboard from "./Fretboard";
import { playScale, playChord, playNote } from "@/lib/audio";
import { scaleDots } from "@/lib/guitar";
import { buildScaleView, type BuiltChord } from "@/lib/music";
import type { Instrument } from "./ChordCard";

type Props = {
  open: boolean;
  onClose: () => void;
  chord: BuiltChord | null;
  tonicPc: number;
  instrument: Instrument;
  /** persist the pick back onto the chord so it also shows on the main board */
  onPick: (scaleIndex: number | null) => void;
};

export default function ScaleModal({ open, onClose, chord, tonicPc, instrument, onPick }: Props) {
  // open on whatever scale this chord already has selected
  const [tab, setTab] = useState(chord?.scale ?? 0);
  const [degrees, setDegrees] = useState(false);
  if (!chord) return null;

  const idx = Math.min(tab, chord.scaleOptions.length - 1);
  const view = buildScaleView(chord, idx, tonicPc);

  // the same scale mapped across the whole neck
  const chordPcs = new Set(chord.notes.filter((n) => n.role !== "bass").map((n) => n.pc));
  const neck = scaleDots(chord.rootPc, view.scale, tonicPc, chordPcs);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <>
          {chord.symbol} <span className="text-[var(--muted)]">·</span>{" "}
          <span className="text-[var(--violet)]">{view.scale.name}</span>
        </>
      }
      subtitle={
        instrument === "piano"
          ? `${chord.roman} — two octaves from the root · chord tones stay lit inside the scale`
          : `${chord.roman} — the whole neck · chord tones stay lit inside the scale`
      }
      actions={
        <>
          {instrument === "guitar" && (
            <button
              type="button"
              onClick={() => setDegrees((d) => !d)}
              className={[
                "rounded-lg px-3 py-2 text-sm font-semibold transition ring-1",
                degrees
                  ? "bg-[var(--amber)] text-black ring-transparent"
                  : "text-[var(--muted)] ring-[var(--line-bright)] hover:text-[var(--ink)]",
              ].join(" ")}
            >
              {degrees ? "Degrees" : "Note names"}
            </button>
          )}
          <button
            type="button"
            onClick={() => playScale(view.notes.map((n) => n.midi), { updown: true })}
            className="rounded-lg bg-[var(--violet)] px-3 py-2 text-sm font-semibold text-black transition hover:opacity-90"
          >
            ▶ Run the scale
          </button>
          <button
            type="button"
            onClick={() => playChord(chord.notes.map((n) => n.midi), { roll: true })}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-[var(--muted)] ring-1 ring-[var(--line-bright)] transition hover:text-[var(--ink)]"
          >
            ▶ Chord
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5 p-5">
        {/* scale tabs */}
        <div className="flex flex-wrap gap-1.5">
          {chord.scaleOptions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { setTab(i); onPick(i); }}
              className={[
                "rounded-lg px-3 py-1.5 text-sm transition",
                i === idx
                  ? "bg-[var(--violet)] font-semibold text-black"
                  : "bg-white/5 text-[var(--muted)] hover:bg-white/10 hover:text-[var(--ink)]",
              ].join(" ")}
            >
              {s.name}
            </button>
          ))}
        </div>

        {/* the instrument */}
        <div className="rounded-xl bg-[#0b0910] p-4 ring-1 ring-black/40">
          {instrument === "piano" ? (
            <Piano range={view.range} notes={view.notes} showDegrees onNote={playNote} />
          ) : (
            <Fretboard dots={neck} showDegrees={degrees} onNote={playNote} />
          )}
        </div>

        {/* legend + why */}
        <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="max-w-prose text-[15px] leading-relaxed text-[var(--ink)]">{view.scale.note}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {view.notes
                .filter((n) => n.midi <= view.notes[0].midi + 12)
                .map((n, i) => (
                  <span
                    key={i}
                    className={[
                      "flex items-baseline gap-1.5 rounded-md px-2 py-1 font-mono text-[13px] ring-1",
                      n.role === "root"
                        ? "bg-[var(--coral)]/15 text-[var(--coral)] ring-[var(--coral)]/30"
                        : n.role === "tone"
                          ? "bg-[var(--amber)]/15 text-[var(--amber)] ring-[var(--amber)]/30"
                          : "bg-[var(--violet)]/10 text-[var(--violet)] ring-[var(--violet)]/25",
                    ].join(" ")}
                  >
                    {n.name}
                    <span className="text-[10px] opacity-70">{n.degree}</span>
                  </span>
                ))}
            </div>
          </div>

          <ul className="flex shrink-0 flex-col gap-2 font-mono text-[11px] text-[var(--muted)]">
            <Legend color="var(--coral)">root of the chord</Legend>
            <Legend color="var(--amber)">chord tone — already in the voicing</Legend>
            <Legend color="var(--violet)">scale tone — the notes you add</Legend>
          </ul>
        </div>

        <button
          type="button"
          onClick={() => { onPick(null); onClose(); }}
          className="self-start rounded-lg px-3 py-1.5 font-mono text-xs text-[var(--muted)] transition hover:bg-white/5 hover:text-[var(--coral)]"
        >
          Clear scale from this chord
        </button>
      </div>
    </Modal>
  );
}

function Legend({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: color }} />
      {children}
    </li>
  );
}
