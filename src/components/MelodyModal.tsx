"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "./Modal";
import { TabStaff, PianoRoll } from "./Notation";
import { playGroove, playNote, type ProgressionHandle } from "@/lib/audio";
import { grooveToMidi, downloadMidi } from "@/lib/midi";
import { buildGroove, fitPatterns, grooveBeats, type Groove } from "@/lib/groove";
import { generateMelody, type MelodyOpts } from "@/lib/melody";
import type { ExNote } from "@/lib/exercises";
import type { BuiltChord } from "@/lib/music";
import type { Instrument } from "./ChordCard";

type Props = {
  open: boolean;
  onClose: () => void;
  chords: BuiltChord[];
  voices: number[][];
  tonicPc: number;
  groove: Groove;
  bpm: number;
  instrument: Instrument;
  name: string;
  opts: MelodyOpts;
  onOptsChange: (o: MelodyOpts) => void;
};

export default function MelodyModal({
  open, onClose, chords, voices, tonicPc, groove, bpm, instrument, name, opts, onOptsChange,
}: Props) {
  const [tempo, setTempo] = useState(bpm);
  const [loop, setLoop] = useState(true);
  const [playing, setPlaying] = useState(false);
  const handleRef = useRef<ProgressionHandle | null>(null);
  const loopRef = useRef(loop);
  useEffect(() => { loopRef.current = loop; }, [loop]);

  const g = fitPatterns(groove, chords.length);
  const melody = useMemo(
    () => generateMelody(chords, tonicPc, g, opts),
    [chords, tonicPc, g, opts],
  );
  const events = useMemo(() => buildGroove(voices, g), [voices, g]);

  const stop = () => {
    handleRef.current?.stop();
    handleRef.current = null;
    setPlaying(false);
  };
  useEffect(() => () => { handleRef.current?.stop(); }, []);

  const start = () => {
    if (!melody.length) return;
    handleRef.current = playGroove(
      events, tempo, grooveBeats(chords.length),
      () => {},
      () => {
        handleRef.current = null;
        if (loopRef.current && open) start();
        else stop();
      },
      melody.map((n) => ({ midi: n.midi, beat: n.beat, durBeats: n.durBeats, velocity: n.velocity })),
    );
    setPlaying(true);
  };
  const play = () => (handleRef.current ? stop() : start());

  const set = (patch: Partial<MelodyOpts>) => { stop(); onOptsChange({ ...opts, ...patch }); };
  const reroll = () => { stop(); onOptsChange({ ...opts, seed: opts.seed + 1 }); };
  const close = () => { stop(); onClose(); };

  // the notation components lay notes out in order — that's all they need
  const asExNotes: ExNote[] = melody.map((n) => ({
    midi: n.midi,
    name: n.name,
    chordIndex: n.chordIndex,
    beat: Math.round((n.beat % 4) * 2),
    role: n.role,
    degree: "",
  }));

  const gestures = [...new Set(melody.map((m) => m.gesture))];

  return (
    <Modal
      open={open}
      onClose={close}
      title="Melody"
      subtitle="A line built from motifs, space and mixed devices — not a drill"
      actions={
        <>
          <button
            type="button"
            onClick={() =>
              downloadMidi(
                grooveToMidi(
                  events, tempo, name,
                  melody.map((n) => ({ midi: n.midi, beat: n.beat, durBeats: n.durBeats, velocity: n.velocity })),
                ),
                `${name.replace(/\s+/g, "-").toLowerCase()}-melody`,
              )
            }
            title="Comp and melody on separate tracks, with all the velocities and timing intact"
            className="rounded-lg px-3 py-2 font-mono text-xs text-[var(--ink)] ring-1 ring-[var(--line-bright)] transition hover:bg-white/10"
          >
            ⬇ MIDI
          </button>
          <div className="hidden items-center gap-2 sm:flex">
            <input
              type="range" min={50} max={180} value={tempo}
              onChange={(e) => { stop(); setTempo(Number(e.target.value)); }}
              className="accent-[var(--amber)]" aria-label="Tempo"
            />
            <span className="w-14 font-mono text-xs tabular-nums text-[var(--muted)]">{tempo} bpm</span>
          </div>
          <button
            type="button"
            onClick={reroll}
            className="rounded-lg bg-[var(--violet)] px-3 py-2 text-sm font-semibold text-black transition hover:opacity-90"
          >
            🎲 New idea
          </button>
          <button
            type="button"
            onClick={() => setLoop((l) => !l)}
            className={[
              "rounded-lg px-3 py-2 text-sm font-semibold transition ring-1",
              loop ? "bg-[var(--amber)] text-black ring-transparent"
                   : "text-[var(--muted)] ring-[var(--line-bright)] hover:text-[var(--ink)]",
            ].join(" ")}
          >
            ↻ Loop
          </button>
          <button
            type="button"
            onClick={play}
            className={[
              "rounded-lg px-4 py-2 text-sm font-semibold transition",
              playing ? "bg-[var(--coral)] text-black" : "bg-[var(--ink)] text-black hover:opacity-90",
            ].join(" ")}
          >
            {playing ? "■ Stop" : "▶ Play"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5 p-5">
        <p className="max-w-prose text-[15px] leading-relaxed text-[var(--ink)]">
          Random notes aren&apos;t a melody. This builds one the way a player does: it states an
          idea, then <em>repeats and sequences</em> it over the next chord; it leaves gaps; it mixes
          arpeggios, scale runs, neighbour tones, leaps and chromatic enclosures; it arcs up to a
          peak and comes back down; and it aims at the next chord&apos;s 3rd so each bar sounds like
          it <em>meant</em> to get there.
        </p>

        {/* the dials */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          <Dial label="Motif" value={pct(opts.motif)} hint="How often an idea comes back, transposed to the new chord. The single most important dial — turn it down and it noodles."
            accent="var(--violet)">
            <input type="range" min={0} max={100} value={Math.round(opts.motif * 100)}
              onChange={(e) => set({ motif: Number(e.target.value) / 100 })}
              className="w-full accent-[var(--violet)]" />
          </Dial>
          <Dial label="Density" value={pct(opts.density)} hint="Busy or sparse. Low means long notes and rests — space is a note too."
            accent="var(--amber)">
            <input type="range" min={0} max={100} value={Math.round(opts.density * 100)}
              onChange={(e) => set({ density: Number(e.target.value) / 100 })}
              className="w-full accent-[var(--amber)]" />
          </Dial>
          <Dial label="Chromaticism" value={pct(opts.chromaticism)} hint="How much it enclosures and approaches from outside the key."
            accent="var(--coral)">
            <input type="range" min={0} max={100} value={Math.round(opts.chromaticism * 100)}
              onChange={(e) => set({ chromaticism: Number(e.target.value) / 100 })}
              className="w-full accent-[var(--coral)]" />
          </Dial>
          <Dial label="Leap" value={pct(opts.leap)} hint="Wide intervals, recovered stepwise. A little goes a long way."
            accent="var(--amber)">
            <input type="range" min={0} max={100} value={Math.round(opts.leap * 100)}
              onChange={(e) => set({ leap: Number(e.target.value) / 100 })}
              className="w-full accent-[var(--amber)]" />
          </Dial>
          <Dial label="Humanize" value={pct(opts.humanize)} hint="Velocity and micro-timing slop. This is what stops it sounding typed."
            accent="var(--violet)">
            <input type="range" min={0} max={100} value={Math.round(opts.humanize * 100)}
              onChange={(e) => set({ humanize: Number(e.target.value) / 100 })}
              className="w-full accent-[var(--violet)]" />
          </Dial>
        </div>

        {/* the line */}
        <div className="rounded-xl bg-[#0b0910] p-3 ring-1 ring-black/40">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
            {instrument === "guitar" ? "Tab" : "Piano roll"} — click any note to hear it
          </div>
          {melody.length === 0 ? (
            <p className="p-4 font-mono text-sm text-[var(--muted)]">No notes — add some chords first.</p>
          ) : instrument === "guitar" ? (
            <TabStaff notes={asExNotes} chords={chords} activeIdx={null} onNote={playNote} />
          ) : (
            <PianoRoll notes={asExNotes} chords={chords} activeIdx={null} onNote={playNote} />
          )}
        </div>

        {/* what it did */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] text-[var(--muted)]">
          <span>{melody.length} notes</span>
          <span>
            devices used:{" "}
            <span className="text-[var(--ink)]">{gestures.join(" · ") || "—"}</span>
          </span>
          <span><span className="text-[var(--amber)]">■</span> chord tone</span>
          <span><span className="text-[var(--coral)]">■</span> target</span>
          <span><span className="text-[var(--violet)]">■</span> approach / chromatic</span>
        </div>
      </div>
    </Modal>
  );
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

function Dial({
  label, value, hint, accent, children,
}: {
  label: string; value: string; hint: string; accent: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: accent }}>
          {label}
        </span>
        <span className="font-mono text-xs tabular-nums text-[var(--ink)]">{value}</span>
      </div>
      {children}
      <p className="mt-1 text-[11px] leading-snug text-[var(--muted)]">{hint}</p>
    </div>
  );
}
