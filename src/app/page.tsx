import Board from "@/components/Board";

export default function Home() {
  return (
    <main className="min-h-full">
      <header className="mx-auto w-full max-w-6xl px-4 pt-10 pb-2 sm:px-6">
        <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-[var(--amber)]">
          The Voicing Board
        </div>
        <h1 className="mt-2 font-serif text-4xl leading-[1.05] text-[var(--ink)] sm:text-5xl" style={{ textWrap: "balance" }}>
          Chord progressions,{" "}
          <span className="italic text-[var(--coral)]">laid out on the keys.</span>
        </h1>
        <p className="mt-3 max-w-prose text-[15px] text-[var(--muted)]">
          Pick a key and a style — neo-soul, Glasper, R&amp;B, jazz — and see the voicings
          spread across the piano so you can just look down and play.
        </p>
      </header>
      <Board />
    </main>
  );
}
