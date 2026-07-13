"use client";

import { useMemo, useState } from "react";
import { playChord } from "@/lib/audio";
import {
  PRINCIPLES,
  suggestNext,
  surpriseMe,
  type PrincipleId,
  type Suggestion,
} from "@/lib/suggest";
import { buildChord, type WorkingChord } from "@/lib/music";

type Props = {
  chords: WorkingChord[];
  tonicPc: number;
  styleId: string;
  onAdd: (chord: WorkingChord) => void;
  onExtend: (howMany: number, seed: number, principle: PrincipleId | "all") => void;
};

export default function SuggestPanel({ chords, tonicPc, styleId, onAdd, onExtend }: Props) {
  const [filter, setFilter] = useState<PrincipleId | "all">("all");
  const [seed, setSeed] = useState(1);

  const prev = chords.length ? chords[chords.length - 1] : null;

  const suggestions = useMemo(
    () => suggestNext(prev, tonicPc, styleId, filter).slice(0, 9),
    [prev, tonicPc, styleId, filter],
  );

  const hit = (s: Suggestion) => {
    playChord(buildChord(s.chord, tonicPc).notes.map((n) => n.midi), { roll: true });
  };

  const surprise = () => {
    const all = suggestNext(prev, tonicPc, styleId, filter);
    const pick = surpriseMe(all, seed);
    setSeed((x) => x + 1);
    if (pick) onAdd(pick.chord);
  };

  return (
    <section
      className="rounded-2xl border border-[var(--line)] p-5"
      style={{ background: "var(--panel)" }}
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-serif text-2xl text-[var(--ink)]">
            {prev ? "What comes next?" : "How do you want to start?"}
          </h3>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {prev
              ? "Every option is derived from a theory principle, ranked by how well it voice-leads from your last chord."
              : "Pick an opening chord from the key."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={surprise}
            className="rounded-lg bg-[var(--coral)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
          >
            🎲 Surprise me
          </button>
          <button
            type="button"
            onClick={() => { onExtend(4, seed, filter); setSeed((x) => x + 1); }}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-[var(--ink)] ring-1 ring-[var(--line-bright)] transition hover:bg-white/10"
          >
            ⚡ Build 4 more
          </button>
        </div>
      </div>

      {/* principle filter */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>
          All principles
        </Chip>
        {PRINCIPLES.map((p) => (
          <Chip key={p.id} active={filter === p.id} onClick={() => setFilter(p.id)} title={p.blurb}>
            {p.name}
          </Chip>
        ))}
      </div>

      {filter !== "all" && (
        <p className="mb-4 max-w-prose text-[13px] leading-relaxed text-[var(--muted)]">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--amber)]">
            {PRINCIPLES.find((p) => p.id === filter)?.name} ·{" "}
          </span>
          {PRINCIPLES.find((p) => p.id === filter)?.blurb}
        </p>
      )}

      {/* the options */}
      {suggestions.length === 0 ? (
        <p className="font-mono text-sm text-[var(--muted)]">
          No options for that principle from this chord.
        </p>
      ) : (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {suggestions.map((s, i) => (
            <div
              key={`${s.chord.rootPc}-${s.chord.quality}-${i}`}
              className="flex flex-col gap-2 rounded-xl border border-[var(--line)] p-4 transition hover:border-[var(--line-bright)]"
            >
              <div className="flex items-baseline justify-between gap-2">
                <button
                  type="button"
                  onClick={() => hit(s)}
                  title="Hear it"
                  className="font-serif text-2xl text-[var(--ink)] transition hover:text-[var(--coral)]"
                >
                  {s.symbol}
                </button>
                <span className="font-mono text-[11px] text-[var(--amber)]">{s.roman}</span>
              </div>

              <span className="w-fit rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--violet)] ring-1 ring-[var(--violet)]/25">
                {s.principleName}
              </span>

              <p className="text-[12px] leading-relaxed text-[var(--muted)]">{s.why}</p>

              {prev && (
                <div className="font-mono text-[10px] text-[var(--muted)]">
                  {s.common > 0 ? (
                    <span className="text-[var(--amber)]">
                      {s.common} common tone{s.common === 1 ? "" : "s"}
                    </span>
                  ) : (
                    <span>no common tones</span>
                  )}{" "}
                  · {s.totalMotion} semitones of movement
                </div>
              )}

              <button
                type="button"
                onClick={() => onAdd(s.chord)}
                className="mt-auto rounded-lg bg-[var(--amber)]/10 px-3 py-1.5 font-mono text-xs text-[var(--amber)] ring-1 ring-[var(--amber)]/40 transition hover:bg-[var(--amber)]/20"
              >
                ＋ Add {s.symbol}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Chip({
  children, active, onClick, title,
}: {
  children: React.ReactNode; active: boolean; onClick: () => void; title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={[
        "rounded-lg px-3 py-1.5 text-sm transition",
        active
          ? "bg-[var(--violet)] font-semibold text-black"
          : "bg-white/5 text-[var(--muted)] hover:bg-white/10 hover:text-[var(--ink)]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
