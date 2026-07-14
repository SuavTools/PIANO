"use client";

import Modal from "./Modal";
import { playChord } from "@/lib/audio";
import { approachesTo, familyOf } from "@/lib/family";
import { QUALITIES, buildChord, defaultChord, noteNameFor, type BuiltChord, type WorkingChord } from "@/lib/music";

type Props = {
  open: boolean;
  onClose: () => void;
  chord: BuiltChord | null;
  working: WorkingChord | null;
  tonicPc: number;
  /** pop and house want triads, not altered dominants */
  simple: boolean;
  /** drop these chords into the progression, just before the target */
  onInsert: (chords: WorkingChord[]) => void;
};

export default function FamilyModal({
  open, onClose, chord, working, tonicPc, simple, onInsert,
}: Props) {
  if (!chord || !working) return null;

  const family = familyOf(chord.rootPc, chord.quality, simple);
  const approaches = approachesTo(working, tonicPc, simple);

  const hearOne = (wc: WorkingChord) =>
    playChord(buildChord(wc, tonicPc).notes.map((n) => n.midi), { roll: true });

  /** play the approach and then the target, so you hear the arrival */
  const hearApproach = (chords: WorkingChord[]) => {
    const seq = [...chords, working];
    seq.forEach((wc, i) => {
      window.setTimeout(
        () => playChord(buildChord(wc, tonicPc).notes.map((n) => n.midi), { roll: true }),
        i * 850,
      );
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <>
          Getting to <span className="text-[var(--amber)]">{chord.symbol}</span>
        </>
      }
      subtitle="Treat this chord as a temporary tonic — then borrow its family to arrive on it"
    >
      <div className="flex flex-col gap-8 p-5">
        <p className="max-w-prose text-[15px] leading-relaxed text-[var(--ink)]">
          This is the idea that unlocks gospel and jazz harmony:{" "}
          <strong className="text-[var(--ink)]">any chord can be treated as a temporary tonic</strong>.
          The moment you do, it brings its whole family with it — its own ii, its own V, its own
          passing diminished — and you can play those to lead into it, even though{" "}
          <em>none of them belong to the key you&apos;re actually in</em>. That borrowed quality is
          exactly what makes it sound like an arrival rather than just the next chord.
        </p>

        {/* ---------------- the approaches ---------------- */}
        <section>
          <h3 className="mb-1 font-serif text-2xl text-[var(--ink)]">
            Ways in — insert these before {chord.symbol}
          </h3>
          <p className="mb-4 text-sm text-[var(--muted)]">
            Hear it, then drop it straight into the progression.
          </p>

          <div className="grid gap-2 lg:grid-cols-2">
            {approaches.map((a) => (
              <div
                key={a.id}
                className="flex flex-col gap-2 rounded-xl border border-[var(--line)] p-4"
                style={{ background: "var(--panel)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="font-mono text-sm text-[var(--amber)]">{a.name}</span>
                </div>

                <div className="font-serif text-lg text-[var(--ink)]">{a.label}</div>

                <p className="text-[12px] leading-relaxed text-[var(--muted)]">{a.why}</p>

                <div className="mt-auto flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => hearApproach(a.chords)}
                    className="rounded-lg px-3 py-1.5 font-mono text-xs text-[var(--ink)] ring-1 ring-[var(--line-bright)] transition hover:bg-white/10"
                  >
                    ▶ Hear it land
                  </button>
                  <button
                    type="button"
                    onClick={() => { onInsert(a.chords); onClose(); }}
                    className="rounded-lg bg-[var(--amber)]/15 px-3 py-1.5 font-mono text-xs text-[var(--amber)] ring-1 ring-[var(--amber)]/40 transition hover:bg-[var(--amber)]/25"
                  >
                    ＋ Insert before {chord.symbol}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------- the family ---------------- */}
        <section>
          <h3 className="mb-1 font-serif text-2xl text-[var(--ink)]">
            The family of {noteNameFor(chord.rootPc, tonicPc)}
          </h3>
          <p className="mb-4 max-w-prose text-sm text-[var(--muted)]">
            If {noteNameFor(chord.rootPc, tonicPc)} were the tonic, these would be its chords. Every
            one of them is fair game as a way into it — and the{" "}
            <span className="text-[var(--amber)]">ii</span> and{" "}
            <span className="text-[var(--amber)]">V</span> are the two you&apos;ll reach for most.
          </p>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {family.map((f) => {
              const wc = defaultChord(f.rootPc, f.quality);
              const sym = `${noteNameFor(f.rootPc, tonicPc)}${QUALITIES[f.quality].symbol}`;
              const key = f.roman === "ii" || f.roman === "iiø" || f.roman === "V";
              return (
                <div
                  key={f.roman}
                  className={[
                    "flex flex-col gap-1 rounded-xl border p-3",
                    key ? "border-[var(--amber)]/50" : "border-[var(--line)]",
                  ].join(" ")}
                  style={{ background: "var(--panel)" }}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => hearOne(wc)}
                      title="Hear it"
                      className="font-serif text-xl text-[var(--ink)] transition hover:text-[var(--coral)]"
                    >
                      {sym}
                    </button>
                    <span
                      className={[
                        "font-mono text-[11px]",
                        key ? "text-[var(--amber)]" : "text-[var(--muted)]",
                      ].join(" ")}
                    >
                      {f.roman}
                    </span>
                  </div>
                  <p className="text-[11px] leading-snug text-[var(--muted)]">{f.role}</p>
                  <button
                    type="button"
                    onClick={() => { onInsert([wc]); onClose(); }}
                    className="mt-auto self-start rounded-md px-1.5 py-0.5 font-mono text-[10px] text-[var(--muted)] transition hover:text-[var(--amber)]"
                  >
                    ＋ insert before
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </Modal>
  );
}
