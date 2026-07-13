"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "./Modal";
import { playGroove, type ProgressionHandle } from "@/lib/audio";
import { grooveToMidi, downloadMidi } from "@/lib/midi";
import {
  FEELS, PATTERNS, STEPS, MAX_SWING,
  buildGroove, fitPatterns, grooveBeats,
  type Groove,
} from "@/lib/groove";
import type { BuiltChord } from "@/lib/music";

type Props = {
  open: boolean;
  onClose: () => void;
  chords: BuiltChord[];
  voices: number[][];
  groove: Groove;
  onChange: (g: Groove) => void;
  bpm: number;
  name: string;
};

const STEP_LABELS = ["1", "&", "2", "&", "3", "&", "4", "&"];

export default function GrooveModal({
  open, onClose, chords, voices, groove, onChange, bpm, name,
}: Props) {
  const [tempo, setTempo] = useState(bpm);
  const [hit, setHit] = useState<{ c: number; s: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const handleRef = useRef<ProgressionHandle | null>(null);
  const loopRef = useRef(loop);
  useEffect(() => { loopRef.current = loop; }, [loop]);

  const g = fitPatterns(groove, chords.length);
  const events = buildGroove(voices, g);

  const stop = () => {
    handleRef.current?.stop();
    handleRef.current = null;
    setHit(null);
    setPlaying(false);
  };
  useEffect(() => () => { handleRef.current?.stop(); }, []);

  const start = () => {
    if (!events.length) return;
    handleRef.current = playGroove(
      events, tempo, grooveBeats(chords.length),
      (c, s) => setHit({ c, s }),
      () => {
        handleRef.current = null;
        if (loopRef.current && open) start();
        else stop();
      },
    );
    setPlaying(true);
  };
  const play = () => (handleRef.current ? stop() : start());

  const set = (patch: Partial<Groove>) => { stop(); onChange({ ...g, ...patch }); };

  // click a cell: rest → hit → accent → rest
  const cycle = (c: number, s: number) => {
    stop();
    const patterns = g.patterns.map((p) => [...p]);
    patterns[c][s] = (patterns[c][s] + 1) % 3;
    onChange({ ...g, patterns });
  };

  const applyPattern = (steps: number[], only?: number) => {
    stop();
    const patterns = g.patterns.map((p, i) =>
      only === undefined || only === i ? [...steps] : [...p],
    );
    onChange({ ...g, patterns });
  };

  const applyFeel = (f: (typeof FEELS)[number]) => {
    stop();
    onChange({ ...g, swing: f.swing, length: f.length, humanize: f.humanize, laidBack: f.laidBack });
  };

  const activeFeel = FEELS.find(
    (f) => Math.abs(f.swing - g.swing) < 0.005 && Math.abs(f.length - g.length) < 0.03,
  );

  const close = () => { stop(); onClose(); };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Groove"
      subtitle="Swing, rhythm and articulation — the difference between correct and musical"
      actions={
        <>
          <button
            type="button"
            onClick={() =>
              downloadMidi(
                grooveToMidi(events, tempo, name),
                `${name.replace(/\s+/g, "-").toLowerCase()}-groove`,
              )
            }
            title="Export the groove as MIDI — swing, rests, accents and note length all survive"
            className="rounded-lg px-3 py-2 font-mono text-xs text-[var(--ink)] ring-1 ring-[var(--line-bright)] transition hover:bg-white/10"
          >
            ⬇ MIDI
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
              type="range" min={50} max={180} value={tempo}
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
            {playing ? "■ Stop" : "▶ Play the groove"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-6 p-5">
        {/* ---- feel ---- */}
        <section>
          <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
            1 · The feel
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {FEELS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => applyFeel(f)}
                className={[
                  "rounded-lg px-3 py-1.5 text-sm transition",
                  activeFeel?.id === f.id
                    ? "bg-[var(--amber)] font-semibold text-black"
                    : "bg-white/5 text-[var(--muted)] hover:bg-white/10 hover:text-[var(--ink)]",
                ].join(" ")}
              >
                {f.name}
              </button>
            ))}
          </div>
          {activeFeel && (
            <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-[var(--muted)]">
              {activeFeel.why}
            </p>
          )}
        </section>

        {/* ---- the three dials ---- */}
        <section className="grid gap-5 sm:grid-cols-3">
          <Dial
            label="Swing"
            value={`${Math.round((g.swing / MAX_SWING) * 100)}%`}
            hint="How late the off-beats land. 100% is full triplet swing."
          >
            <input
              type="range" min={0} max={100} value={Math.round((g.swing / MAX_SWING) * 100)}
              onChange={(e) => set({ swing: (Number(e.target.value) / 100) * MAX_SWING })}
              className="w-full accent-[var(--amber)]"
            />
          </Dial>
          <Dial
            label="Note length"
            value={g.length < 0.3 ? "staccato" : g.length > 0.8 ? "legato" : `${Math.round(g.length * 100)}%`}
            hint="How soon you let go of the keys. Short = the silence becomes the rhythm."
          >
            <input
              type="range" min={10} max={100} value={Math.round(g.length * 100)}
              onChange={(e) => set({ length: Number(e.target.value) / 100 })}
              className="w-full accent-[var(--coral)]"
            />
          </Dial>
          <Dial
            label="Humanize"
            value={`${Math.round(g.humanize * 100)}%`}
            hint="A little timing and velocity slop. Perfect timing is what makes it sound like a computer."
          >
            <input
              type="range" min={0} max={100} value={Math.round(g.humanize * 100)}
              onChange={(e) => set({ humanize: Number(e.target.value) / 100 })}
              className="w-full accent-[var(--violet)]"
            />
          </Dial>
        </section>

        {/* ---- the sequencer ---- */}
        <section>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
              2 · The rhythm — click a step. Once = hit, twice = accent, again = rest.
            </h3>
            <div className="flex flex-wrap gap-1">
              {PATTERNS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPattern(p.steps)}
                  title={p.why}
                  className="rounded-md bg-white/5 px-2 py-1 font-mono text-[11px] text-[var(--muted)] transition hover:bg-white/10 hover:text-[var(--ink)]"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--line)] p-3" style={{ background: "var(--panel)" }}>
            {/* beat ruler */}
            <div className="mb-1.5 flex items-center gap-2">
              <div className="w-32 shrink-0" />
              <div className="grid flex-1 grid-cols-8 gap-1">
                {STEP_LABELS.map((l, i) => (
                  <div
                    key={i}
                    className={[
                      "text-center font-mono text-[11px]",
                      i % 2 === 0 ? "text-[var(--ink)]" : "text-[var(--muted)]",
                    ].join(" ")}
                  >
                    {l}
                  </div>
                ))}
              </div>
              <div className="w-16 shrink-0" />
            </div>

            {chords.map((ch, ci) => (
              <div key={ci} className="mb-1 flex items-center gap-2">
                <div className="w-32 shrink-0 truncate font-serif text-lg text-[var(--ink)]">
                  {ch.symbol}
                </div>
                <div className="grid flex-1 grid-cols-8 gap-1">
                  {Array.from({ length: STEPS }, (_, s) => {
                    const v = g.patterns[ci]?.[s] ?? 0;
                    const isHit = hit?.c === ci && hit?.s === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => cycle(ci, s)}
                        aria-label={`${ch.symbol} step ${s + 1}`}
                        className={[
                          "h-9 rounded-md border transition",
                          isHit
                            ? "border-[var(--ink)] bg-[var(--ink)]"
                            : v === 2
                              ? "border-[var(--coral)] bg-[var(--coral)]"
                              : v === 1
                                ? "border-[var(--amber)]/60 bg-[var(--amber)]/40"
                                : s % 2 === 0
                                  ? "border-[var(--line-bright)] bg-white/[0.04] hover:bg-white/10"
                                  : "border-[var(--line)] bg-transparent hover:bg-white/5",
                        ].join(" ")}
                      />
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => applyPattern([0, 0, 0, 0, 0, 0, 0, 0], ci)}
                  className="w-16 shrink-0 rounded-md px-1 py-1 font-mono text-[10px] text-[var(--muted)] transition hover:text-[var(--coral)]"
                >
                  clear
                </button>
              </div>
            ))}
          </div>

          <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-[var(--muted)]">
            <span className="text-[var(--coral)]">Coral = accent</span>,{" "}
            <span className="text-[var(--amber)]">amber = hit</span>, empty = rest. The rests matter as
            much as the hits — <em>On 2 &amp; 4</em> works precisely because nothing happens on beat 1.
          </p>
        </section>
      </div>
    </Modal>
  );
}

function Dial({
  label, value, hint, children,
}: { label: string; value: string; hint: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">{label}</span>
        <span className="font-mono text-xs text-[var(--ink)] tabular-nums">{value}</span>
      </div>
      {children}
      <p className="mt-1 text-[11px] leading-snug text-[var(--muted)]">{hint}</p>
    </div>
  );
}
