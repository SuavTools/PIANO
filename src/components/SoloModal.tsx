"use client";

import { useState } from "react";
import Modal from "./Modal";
import Piano from "./Piano";
import Fretboard from "./Fretboard";
import { playSequence, playChord, playNote } from "@/lib/audio";
import { ENCLOSURES, buildEnclosure, targetsFor } from "@/lib/solo";
import { TUNING, FRET_COUNT, type FretDot } from "@/lib/guitar";
import { SCALES_FOR, noteNameFor, type BuiltChord } from "@/lib/music";
import type { Instrument } from "./ChordCard";

const mod12 = (n: number) => ((n % 12) + 12) % 12;

type Props = {
  open: boolean;
  onClose: () => void;
  chord: BuiltChord | null;
  nextChord: BuiltChord | null;
  tonicPc: number;
  instrument: Instrument;
};

export default function SoloModal({ open, onClose, chord, nextChord, tonicPc, instrument }: Props) {
  // default to the money target: the 3rd of the next chord
  const [targetId, setTargetId] = useState<string>(nextChord ? "n3" : "3");
  const [encId, setEncId] = useState("scale-chrom");
  if (!chord) return null;

  const targets = targetsFor(chord, nextChord, tonicPc);
  const target = targets.find((t) => t.id === targetId) ?? targets[0];
  const enc = ENCLOSURES.find((e) => e.id === encId) ?? ENCLOSURES[0];

  // enclosures use the CURRENT chord's scale — you're still over this chord
  const scale = SCALES_FOR[chord.quality][0];
  const scalePcs = scale.intervals.map((iv) => mod12(chord.rootPc + iv));

  const notes = buildEnclosure(enc, target.pc, scalePcs, tonicPc);
  const range = {
    low: Math.floor((Math.min(...notes.map((n) => n.midi)) - 2) / 12) * 12,
    high: Math.ceil((Math.max(...notes.map((n) => n.midi)) + 2) / 12) * 12,
  };

  // the same notes on the neck — nearest playable spot for each
  const dots: FretDot[] = notes.map((n, i) => {
    let best = { string: 3, fret: 0, dist: 99 };
    for (let s = 0; s < TUNING.length; s++) {
      const f = n.midi - TUNING[s];
      if (f < 0 || f > FRET_COUNT) continue;
      const d = Math.abs(f - 7); // prefer the middle of the neck
      if (d < best.dist) best = { string: s, fret: f, dist: d };
    }
    return {
      string: best.string,
      fret: best.fret,
      name: n.name,
      degree: String(i + 1),
      role: i === notes.length - 1 ? "root" : "scale",
    };
  });

  // order matters — an enclosure played in pitch order isn't an enclosure
  const playIt = () => playSequence(notes.map((n) => n.midi));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <>
          Solo lab <span className="text-[var(--muted)]">·</span>{" "}
          <span className="text-[var(--amber)]">{chord.symbol}</span>
        </>
      }
      subtitle={`${enc.name} → landing on ${noteNameFor(target.pc, tonicPc)}${target.next ? ` (the next chord, ${nextChord?.symbol})` : ""}`}
      actions={
        <>
          <button
            type="button"
            onClick={playIt}
            className="rounded-lg bg-[var(--amber)] px-3 py-2 text-sm font-semibold text-black transition hover:opacity-90"
          >
            ▶ Play the approach
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
        {/* the notes, in order */}
        <div className="flex flex-wrap items-center gap-2">
          {notes.map((n, i) => (
            <span key={i} className="flex items-center gap-2">
              <span
                className={[
                  "flex items-baseline gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-sm ring-1",
                  i === notes.length - 1
                    ? "bg-[var(--coral)]/20 text-[var(--coral)] ring-[var(--coral)]/40"
                    : "bg-[var(--violet)]/10 text-[var(--violet)] ring-[var(--violet)]/25",
                ].join(" ")}
              >
                <span className="text-[10px] opacity-60">{i + 1}</span>
                {n.name}
              </span>
              {i < notes.length - 1 && <span className="text-[var(--muted)]">→</span>}
            </span>
          ))}
          <span className="ml-2 font-mono text-[11px] text-[var(--coral)]">← the target lands on the beat</span>
        </div>

        {/* on the instrument */}
        <div className="rounded-xl bg-[#0b0910] p-4 ring-1 ring-black/40">
          {instrument === "piano" ? (
            <Piano range={range} notes={notes} showDegrees onNote={playNote} />
          ) : (
            <Fretboard dots={dots} showDegrees from={0} to={FRET_COUNT} onNote={playNote} />
          )}
        </div>
        <p className="font-mono text-[11px] text-[var(--muted)]">
          The number on each key/fret is the order you play them in.
        </p>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* target */}
          <section>
            <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
              1 · What are you aiming at?
            </h3>
            <div className="flex flex-col gap-1.5">
              {targets.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTargetId(t.id)}
                  className={[
                    "rounded-lg border p-3 text-left transition",
                    t.id === target.id
                      ? "border-[var(--coral)] bg-[var(--coral)]/10"
                      : "border-[var(--line)] hover:border-[var(--line-bright)]",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2">
                    <span className={t.id === target.id ? "font-mono text-sm text-[var(--coral)]" : "font-mono text-sm text-[var(--ink)]"}>
                      {t.name}
                    </span>
                    {t.next && (
                      <span className="rounded bg-[var(--amber)]/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--amber)]">
                        next chord
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[12px] leading-snug text-[var(--muted)]">{t.why}</p>
                </button>
              ))}
            </div>
          </section>

          {/* enclosure */}
          <section>
            <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
              2 · How do you get there?
            </h3>
            <div className="flex flex-col gap-1.5">
              {ENCLOSURES.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setEncId(e.id)}
                  className={[
                    "rounded-lg border p-3 text-left transition",
                    e.id === enc.id
                      ? "border-[var(--amber)] bg-[var(--amber)]/10"
                      : "border-[var(--line)] hover:border-[var(--line-bright)]",
                  ].join(" ")}
                >
                  <span className={e.id === enc.id ? "font-mono text-sm text-[var(--amber)]" : "font-mono text-sm text-[var(--ink)]"}>
                    {e.name}
                  </span>
                  {e.id === enc.id && (
                    <p className="mt-1 text-[12px] leading-snug text-[var(--muted)]">{e.note}</p>
                  )}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </Modal>
  );
}
