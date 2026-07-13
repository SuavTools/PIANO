"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "./Modal";
import Piano from "./Piano";
import Fretboard from "./Fretboard";
import { playLine, playNote, type ProgressionHandle } from "@/lib/audio";
import {
  CELLS,
  DEFAULT_OPTS,
  EXERCISES,
  bebopFor,
  generateExercise,
  type ExNote,
  type ExOpts,
  type ExerciseId,
} from "@/lib/exercises";
import { ENCLOSURES, generateLine } from "@/lib/solo";
import { TabStaff, PianoRoll } from "./Notation";
import { exerciseToMidi, downloadMidi } from "@/lib/midi";
import { guideTones } from "@/lib/voiceleading";
import { TUNING, FRET_COUNT, type FretDot } from "@/lib/guitar";
import type { BuiltChord } from "@/lib/music";
import type { Instrument } from "./ChordCard";

type Props = {
  open: boolean;
  onClose: () => void;
  chords: BuiltChord[];
  voices: number[][];
  tonicPc: number;
  bpm: number;
  instrument: Instrument;
  /** move the whole board down a fifth — how you drill through all 12 keys */
  onCycleKey: () => void;
};

const DEG_NAMES = ["Root", "3rd", "5th", "7th"];

export default function SoloWorkshop({
  open, onClose, chords, voices, tonicPc, bpm, instrument, onCycleKey,
}: Props) {
  const [exId, setExId] = useState<ExerciseId>("guide-tones");
  const [opts, setOpts] = useState<ExOpts>(DEFAULT_OPTS);
  const [tempo, setTempo] = useState(Math.min(bpm, 90));
  const [loop, setLoop] = useState(true);
  const [idx, setIdx] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const handleRef = useRef<ProgressionHandle | null>(null);
  // the loop flag has to be readable from inside the audio callback, which
  // closed over an older render — a ref, synced in an effect, is the honest way
  const loopRef = useRef(loop);
  useEffect(() => { loopRef.current = loop; }, [loop]);

  const ex = EXERCISES.find((e) => e.id === exId)!;

  const notes: ExNote[] = useMemo(() => {
    if (!chords.length) return [];
    if (exId === "bebop-line") {
      return generateLine(chords, tonicPc, "scalar", opts.encId).map((n) => ({
        midi: n.midi,
        name: n.name,
        chordIndex: n.chordIndex,
        beat: 0,
        role: n.isTarget ? "target" : n.isApproach ? "approach" : "scale",
        degree: "",
      }));
    }
    return generateExercise(exId, chords, tonicPc, opts);
  }, [exId, chords, tonicPc, opts]);

  const perChord = notes.length ? notes.length / chords.length : 8;

  const stop = () => {
    handleRef.current?.stop();
    handleRef.current = null;
    setIdx(null);
    setPlaying(false);
  };
  useEffect(() => () => { handleRef.current?.stop(); }, []);

  const start = () => {
    if (!notes.length) return;
    handleRef.current = playLine(
      notes.map((n) => n.midi),
      voices,
      perChord,
      tempo,
      (i) => setIdx(i),
      () => {
        handleRef.current = null;
        if (loopRef.current && open) start();
        else stop();
      },
    );
    setPlaying(true);
  };
  const play = () => (handleRef.current ? stop() : start());

  const change = (patch: Partial<ExOpts>) => { stop(); setOpts((o) => ({ ...o, ...patch })); };
  const pickEx = (id: ExerciseId) => { stop(); setExId(id); };
  const close = () => { stop(); onClose(); };

  // the note currently sounding, and the chord it belongs to
  const active = idx !== null ? notes[idx] : null;
  const focusChord = active ? active.chordIndex : 0;
  const focusNotes = notes.filter((n) => n.chordIndex === focusChord);

  const toPianoNote = (n: ExNote) => ({
    midi: n.midi,
    pc: ((n.midi % 12) + 12) % 12,
    name: n.name,
    degree: n.degree,
    role: (n.role === "target" ? "root" : n.role === "chord" ? "tone" : "scale") as
      "root" | "tone" | "scale",
  });

  const range = focusNotes.length
    ? {
        low: Math.floor((Math.min(...focusNotes.map((n) => n.midi)) - 2) / 12) * 12,
        high: Math.ceil((Math.max(...focusNotes.map((n) => n.midi)) + 2) / 12) * 12,
      }
    : { low: 60, high: 84 };

  // put the exercise on the neck — nearest comfortable position for each note
  const dots: FretDot[] = focusNotes.map((n) => {
    let best = { string: 3, fret: 0, dist: 99 };
    for (let s = 0; s < TUNING.length; s++) {
      const f = n.midi - TUNING[s];
      if (f < 0 || f > FRET_COUNT) continue;
      const d = Math.abs(f - 7);
      if (d < best.dist) best = { string: s, fret: f, dist: d };
    }
    return {
      string: best.string,
      fret: best.fret,
      name: n.name,
      degree: n.degree,
      role: (n.role === "target" ? "root" : n.role === "chord" ? "tone" : "scale") as FretDot["role"],
    };
  });

  const activeFret = active
    ? (() => {
        const d = dots.find((x) => TUNING[x.string] + x.fret === active.midi);
        return d ? `${d.string}:${d.fret}` : null;
      })()
    : null;

  const bb = chords.length ? bebopFor(chords[focusChord]?.quality ?? chords[0].quality) : null;

  return (
    <Modal
      open={open}
      onClose={close}
      title="Solo workshop"
      subtitle={`${ex.name.replace(/^\d+ · /, "")} — over all ${chords.length} chords`}
      actions={
        <>
          <button
            type="button"
            onClick={() =>
              downloadMidi(
                exerciseToMidi(notes.map((n) => n.midi), voices, perChord, tempo, ex.name),
                `${exId}-exercise`,
              )
            }
            title="Download as MIDI — chords and line on separate tracks"
            className="rounded-lg px-3 py-2 font-mono text-xs text-[var(--ink)] ring-1 ring-[var(--line-bright)] transition hover:bg-white/10"
          >
            ⬇ MIDI
          </button>
          <button
            type="button"
            onClick={onCycleKey}
            title="Move the whole thing down a fifth — this is how you drill all 12 keys"
            className="hidden rounded-lg px-3 py-2 font-mono text-xs text-[var(--muted)] ring-1 ring-[var(--line-bright)] transition hover:text-[var(--ink)] sm:block"
          >
            ↻ Next key (cycle of 4ths)
          </button>
          <button
            type="button"
            onClick={() => setLoop((l) => !l)}
            className={[
              "rounded-lg px-3 py-2 text-sm font-semibold transition ring-1",
              loop ? "bg-[var(--violet)] text-black ring-transparent"
                   : "text-[var(--muted)] ring-[var(--line-bright)] hover:text-[var(--ink)]",
            ].join(" ")}
          >
            ↻ Loop
          </button>
          <div className="hidden items-center gap-2 sm:flex">
            <input
              type="range" min={40} max={140} value={tempo}
              onChange={(e) => { stop(); setTempo(Number(e.target.value)); }}
              className="accent-[var(--amber)]" aria-label="Tempo"
            />
            <span className="w-14 font-mono text-xs tabular-nums text-[var(--muted)]">{tempo} bpm</span>
          </div>
          <button
            type="button"
            onClick={play}
            className={[
              "rounded-lg px-4 py-2 text-sm font-semibold transition",
              playing ? "bg-[var(--coral)] text-black" : "bg-[var(--ink)] text-black hover:opacity-90",
            ].join(" ")}
          >
            {playing ? "■ Stop" : "▶ Run it"}
          </button>
        </>
      }
    >
      <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[300px_1fr]">
        {/* ---------- the curriculum ---------- */}
        <aside className="flex flex-col gap-1.5 border-b border-[var(--line)] p-4 lg:border-r lg:border-b-0">
          <h3 className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
            The curriculum
          </h3>
          {EXERCISES.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => pickEx(e.id)}
              className={[
                "rounded-lg border p-3 text-left transition",
                e.id === exId
                  ? "border-[var(--amber)] bg-[var(--amber)]/10"
                  : "border-[var(--line)] hover:border-[var(--line-bright)]",
              ].join(" ")}
            >
              <span
                className={
                  e.id === exId
                    ? "font-mono text-sm text-[var(--amber)]"
                    : "font-mono text-sm text-[var(--ink)]"
                }
              >
                {e.name}
              </span>
            </button>
          ))}
        </aside>

        {/* ---------- the exercise ---------- */}
        <div className="flex min-w-0 flex-col gap-5 p-5">
          {/* what it teaches */}
          <div>
            <p className="max-w-prose text-[15px] leading-relaxed text-[var(--ink)]">{ex.teaches}</p>
            <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-[var(--muted)]">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--coral)]">
                how to practise ·{" "}
              </span>
              {ex.practice}
            </p>
          </div>

          {/* options */}
          <div className="flex flex-wrap items-end gap-4 border-y border-[var(--line)] py-3">
            {(exId === "arpeggio" || exId === "bebop-scale") && (
              <Opt label="Start from">
                <div className="flex overflow-hidden rounded-lg ring-1 ring-[var(--line-bright)]">
                  {DEG_NAMES.map((d, i) => (
                    <button
                      key={d} type="button" onClick={() => change({ startDegree: i })}
                      className={[
                        "px-3 py-1.5 font-mono text-xs transition",
                        opts.startDegree === i
                          ? "bg-[var(--ink)] font-semibold text-black"
                          : "text-[var(--muted)] hover:text-[var(--ink)]",
                      ].join(" ")}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </Opt>
            )}

            {exId === "bebop-scale" && (
              <Opt label="Direction">
                <div className="flex overflow-hidden rounded-lg ring-1 ring-[var(--line-bright)]">
                  {[true, false].map((d) => (
                    <button
                      key={String(d)} type="button" onClick={() => change({ descending: d })}
                      className={[
                        "px-3 py-1.5 font-mono text-xs transition",
                        opts.descending === d
                          ? "bg-[var(--ink)] font-semibold text-black"
                          : "text-[var(--muted)] hover:text-[var(--ink)]",
                      ].join(" ")}
                    >
                      {d ? "↓ Down" : "↑ Up"}
                    </button>
                  ))}
                </div>
              </Opt>
            )}

            {exId === "digital" && (
              <Opt label="Cell">
                <select
                  value={opts.cellId}
                  onChange={(e) => change({ cellId: e.target.value })}
                  className={selectCls}
                >
                  {CELLS.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Opt>
            )}

            {exId === "enclosure-drill" && (
              <>
                <Opt label="Target on every chord">
                  <div className="flex overflow-hidden rounded-lg ring-1 ring-[var(--line-bright)]">
                    {DEG_NAMES.map((d, i) => (
                      <button
                        key={d} type="button" onClick={() => change({ targetDegree: i })}
                        className={[
                          "px-3 py-1.5 font-mono text-xs transition",
                          opts.targetDegree === i
                            ? "bg-[var(--coral)] font-semibold text-black"
                            : "text-[var(--muted)] hover:text-[var(--ink)]",
                        ].join(" ")}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </Opt>
                <Opt label="Enclosure">
                  <select
                    value={opts.encId}
                    onChange={(e) => change({ encId: e.target.value })}
                    className={selectCls}
                  >
                    {ENCLOSURES.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </Opt>
              </>
            )}

            {exId === "bebop-line" && (
              <Opt label="Enclosure into each target">
                <select
                  value={opts.encId}
                  onChange={(e) => change({ encId: e.target.value })}
                  className={selectCls}
                >
                  {ENCLOSURES.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </Opt>
            )}
          </div>

          {/* the cell / bebop explanation */}
          {exId === "digital" && (
            <Note>{CELLS.find((c) => c.id === opts.cellId)?.why}</Note>
          )}
          {exId === "bebop-scale" && bb && (
            <Note>
              <span className="text-[var(--amber)]">{bb.name}</span> — {bb.why}
            </Note>
          )}

          {/* the instrument, showing the chord we're on */}
          <div className="rounded-xl bg-[#0b0910] p-3 ring-1 ring-black/40">
            {instrument === "piano" ? (
              <Piano
                range={range}
                notes={focusNotes.map(toPianoNote)}
                showDegrees
                onNote={playNote}
                activeMidi={active?.midi ?? null}
              />
            ) : (
              <Fretboard dots={dots} onNote={playNote} activeKey={activeFret} />
            )}
          </div>

          {/* the exercise, as something you can actually read and run */}
          <div className="rounded-xl bg-[#0b0910] p-3 ring-1 ring-black/40">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
              {instrument === "guitar" ? "Tab — click a fret to hear it" : "Piano roll — click a note to hear it"}
            </div>
            {instrument === "guitar" ? (
              <TabStaff
                notes={notes} chords={chords} activeIdx={idx}
                onNote={playNote} markDownbeats={exId === "bebop-scale"}
              />
            ) : (
              <PianoRoll
                notes={notes} chords={chords} activeIdx={idx}
                onNote={playNote} markDownbeats={exId === "bebop-scale"}
              />
            )}
          </div>

          {/* guide tones for each chord — the targets you're aiming at */}
          <div className="flex flex-wrap gap-2">
            {chords.map((ch, ci) => {
              const g = guideTones(ch, tonicPc);
              return (
                <span
                  key={ci}
                  className={[
                    "rounded-lg border px-2.5 py-1 font-mono text-[11px]",
                    active && active.chordIndex === ci
                      ? "border-[var(--amber)] text-[var(--ink)]"
                      : "border-[var(--line)] text-[var(--muted)]",
                  ].join(" ")}
                >
                  {ch.symbol} · 3rd <span className="text-[var(--amber)]">{g.thirdName}</span> · 7th{" "}
                  <span className="text-[var(--amber)]">{g.seventhName}</span>
                </span>
              );
            })}
          </div>

          {/* legend */}
          <div className="flex flex-wrap gap-4 font-mono text-[11px] text-[var(--muted)]">
            <span><span className="text-[var(--amber)]">■</span> chord tone</span>
            <span><span className="text-[var(--coral)]">■</span> target</span>
            <span><span className="text-[var(--violet)]">■</span> chromatic / approach note</span>
            {exId === "bebop-scale" && (
              <span className="text-[var(--ink)]">
                ● = downbeat — notice every one of them is a chord tone
              </span>
            )}
            <span>· click any note, key or fret to hear it</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}

const selectCls =
  "appearance-none rounded-lg bg-white/[0.03] px-2.5 py-1.5 font-mono text-sm text-[var(--ink)] ring-1 ring-[var(--line-bright)] focus:outline-none focus:ring-2 focus:ring-[var(--amber)]";

function Opt({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="max-w-prose rounded-lg bg-white/[0.03] p-3 text-[13px] leading-relaxed text-[var(--muted)]">
      {children}
    </p>
  );
}
