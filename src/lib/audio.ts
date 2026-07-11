// ---------------------------------------------------------------------------
// audio.ts — a tiny electric-piano-ish synth (client only)
//
// No samples, no dependencies: two detuned oscillators per note through a
// lowpass and a soft envelope. Warm enough to actually judge a voicing by ear.
// ---------------------------------------------------------------------------

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

const mtof = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

function voice(ac: AudioContext, dest: AudioNode, midi: number, at: number, dur: number, gain: number) {
  const freq = mtof(midi);

  const g = ac.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.012); // quick attack
  g.gain.exponentialRampToValueAtTime(gain * 0.5, at + 0.14); // decay to sustain
  g.gain.setValueAtTime(gain * 0.5, at + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur); // release

  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(2600, at);
  lp.frequency.exponentialRampToValueAtTime(900, at + dur); // mellows as it rings
  lp.Q.value = 0.6;

  const o1 = ac.createOscillator();
  o1.type = "triangle";
  o1.frequency.value = freq;

  const o2 = ac.createOscillator();
  o2.type = "sine";
  o2.frequency.value = freq;
  o2.detune.value = 6; // slight chorus

  o1.connect(g);
  o2.connect(g);
  g.connect(lp);
  lp.connect(dest);

  o1.start(at);
  o2.start(at);
  o1.stop(at + dur + 0.05);
  o2.stop(at + dur + 0.05);
}

/** Play a chord now — optionally rolled bottom-to-top like a real hand. */
export function playChord(midis: number[], opts: { roll?: boolean; dur?: number } = {}) {
  const ac = getCtx();
  const master = ac.createGain();
  master.gain.value = 0.9;
  master.connect(ac.destination);

  const dur = opts.dur ?? 1.7;
  const sorted = [...midis].sort((a, b) => a - b);
  sorted.forEach((m, i) => {
    const at = ac.currentTime + (opts.roll ? i * 0.045 : 0);
    voice(ac, master, m, at, dur, 0.16);
  });
}

export type ProgressionHandle = { stop: () => void };

/**
 * Play a sequence of chords in time, calling `onStep(index)` as each lands and
 * `onEnd()` when finished. Returns a handle so playback can be cancelled.
 */
export function playProgression(
  chords: number[][],
  bpm: number,
  onStep: (i: number) => void,
  onEnd: () => void,
): ProgressionHandle {
  const ac = getCtx();
  const master = ac.createGain();
  master.gain.value = 0.9;
  master.connect(ac.destination);

  const beat = 60 / bpm;
  const step = beat * 2; // one chord per half-bar
  const start = ac.currentTime + 0.06;
  let cancelled = false;
  const timers: ReturnType<typeof setTimeout>[] = [];

  chords.forEach((midis, i) => {
    const at = start + i * step;
    [...midis].sort((a, b) => a - b).forEach((m, j) => {
      voice(ac, master, m, at + j * 0.02, step * 0.95, 0.15);
    });
    // schedule the visual highlight in wall-clock time
    timers.push(
      setTimeout(() => {
        if (!cancelled) onStep(i);
      }, (at - ac.currentTime) * 1000),
    );
  });

  timers.push(
    setTimeout(() => {
      if (!cancelled) onEnd();
    }, (start + chords.length * step - ac.currentTime) * 1000),
  );

  return {
    stop: () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      master.gain.cancelScheduledValues(ac.currentTime);
      master.gain.setTargetAtTime(0, ac.currentTime, 0.05);
    },
  };
}
