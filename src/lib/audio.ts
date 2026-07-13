// ---------------------------------------------------------------------------
// audio.ts — a tiny electric-piano-ish synth (client only)
//
// No samples, no dependencies: two detuned oscillators per note through a
// lowpass and a soft envelope. Warm enough to actually judge a voicing by ear.
// ---------------------------------------------------------------------------

import type { GrooveEvent } from "./groove";

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

/**
 * Equal-power polyphony scaling.
 *
 * Every note used to get the same fixed gain, so a 5-note maj9 + a slash bass +
 * a 3-note upper structure summed to well over unity and CLIPPED. Clipped audio
 * doesn't sound loud, it sounds like mush — and it got worse the more you
 * stacked, which is the exact opposite of what you want from a chord tool.
 */
const polyGain = (base: number, count: number) => base / Math.sqrt(Math.max(1, count));

/** master bus with a soft limiter, so a fat voicing can never clip */
function bus(ac: AudioContext): GainNode {
  const g = ac.createGain();
  g.gain.value = 0.85;

  const limiter = ac.createDynamicsCompressor();
  limiter.threshold.value = -8;
  limiter.knee.value = 6;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.25;

  g.connect(limiter);
  limiter.connect(ac.destination);
  return g;
}

// ---------------------------------------------------------------------------
// The sound.
//
// Not five filter settings on one patch — five genuinely different instruments.
// The envelope is what separates them more than the waveform: a piano decays
// away whether you hold it or not, an organ holds forever and dies instantly
// when you let go, a pluck is gone before you've thought about it.
// ---------------------------------------------------------------------------
export type ToneId = "rhodes" | "piano" | "organ" | "pluck" | "pad" | "bell" | "clav";

export const TONES: { id: ToneId; name: string; why: string }[] = [
  { id: "rhodes", name: "Rhodes", why: "Warm electric piano. Soft attack, bell-like — the neo-soul default." },
  { id: "piano",  name: "Grand piano", why: "Bright hammer attack that decays away whether you hold it or not." },
  { id: "organ",  name: "Organ", why: "Drawbar sines. No decay at all — it holds forever and stops dead when you release." },
  { id: "pluck",  name: "Pluck", why: "Short and percussive. Gone almost before you hear it — good for stabs." },
  { id: "pad",    name: "Pad", why: "Slow swell, detuned, long tail. The chord arrives late and lingers." },
  { id: "bell",   name: "Bell (clear)", why: "Vibraphone-ish. Almost pure sine, high-passed, fast decay — the least mushy sound here. Use it to actually HEAR every note of a stacked chord." },
  { id: "clav",   name: "Clav (thin)", why: "Bright, thin and percussive, with everything below 400Hz stripped out. Nothing to hide in — perfect for auditing upper structures." },
];

let tone: ToneId = "rhodes";
export const setTone = (t: ToneId) => { tone = t; };
export const getTone = () => tone;

function voice(ac: AudioContext, dest: AudioNode, midi: number, at: number, dur: number, gain: number) {
  const freq = mtof(midi);
  const g = ac.createGain();
  const oscs: OscillatorNode[] = [];

  const osc = (type: OscillatorType, detune = 0, mul = 1, level = 1) => {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.value = freq * mul;
    o.detune.value = detune;
    if (level === 1) {
      o.connect(g);
    } else {
      const lv = ac.createGain();
      lv.gain.value = level;
      o.connect(lv);
      lv.connect(g);
    }
    oscs.push(o);
    return o;
  };

  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.Q.value = 0.6;

  // The mud lives between roughly 150 and 400Hz. Every voice gets a high-pass;
  // the "clear" voices get an aggressive one, because a chord can only sound
  // transparent if the low-mids aren't all fighting each other.
  const hp = ac.createBiquadFilter();
  hp.type = "highpass";
  hp.Q.value = 0.5;
  hp.frequency.value = 130;

  let stop = at + dur + 0.05;
  g.gain.setValueAtTime(0, at);

  switch (tone) {
    case "piano": {
      // bright, inharmonic, and it decays whether you hold it or not
      osc("triangle");
      osc("sawtooth", 4, 1, 0.35);
      osc("sine", 0, 2, 0.18);
      const decay = Math.min(2.6, 0.9 + (84 - midi) * 0.03); // bass rings longer
      g.gain.linearRampToValueAtTime(gain * 1.15, at + 0.004);
      g.gain.exponentialRampToValueAtTime(gain * 0.28, at + 0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, at + Math.min(dur + 0.3, decay));
      lp.frequency.setValueAtTime(5200, at);
      lp.frequency.exponentialRampToValueAtTime(1600, at + Math.min(dur + 0.3, decay));
      hp.frequency.value = 120;
      stop = at + Math.min(dur + 0.35, decay) + 0.05;
      break;
    }

    case "organ": {
      // drawbars: fundamental, octave, twelfth, two octaves. Flat sustain.
      osc("sine", 0, 1, 1);
      osc("sine", 0, 2, 0.5);
      osc("sine", 0, 3, 0.25);
      osc("sine", 0, 4, 0.12);
      g.gain.linearRampToValueAtTime(gain * 0.85, at + 0.02);
      g.gain.setValueAtTime(gain * 0.85, at + Math.max(0.03, dur - 0.03));
      g.gain.linearRampToValueAtTime(0, at + dur); // dies the instant you let go
      lp.frequency.value = 3200;
      hp.frequency.value = 160;
      break;
    }

    case "pluck": {
      osc("sawtooth");
      osc("square", 6, 1, 0.25);
      const decay = Math.min(dur, 0.42);
      g.gain.linearRampToValueAtTime(gain * 1.1, at + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
      lp.frequency.setValueAtTime(4200, at);
      lp.frequency.exponentialRampToValueAtTime(600, at + decay);
      hp.frequency.value = 260;
      stop = at + decay + 0.05;
      break;
    }

    case "pad": {
      osc("sawtooth", -7, 1, 0.5);
      osc("sawtooth", 7, 1, 0.5);
      osc("sine", 0, 0.5, 0.3);
      const att = Math.min(0.3, dur * 0.4);
      g.gain.linearRampToValueAtTime(gain * 0.8, at + att);
      g.gain.setValueAtTime(gain * 0.8, at + dur * 0.85);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.5);
      lp.frequency.setValueAtTime(700, at);
      lp.frequency.linearRampToValueAtTime(1900, at + att);
      lp.frequency.exponentialRampToValueAtTime(800, at + dur + 0.5);
      hp.frequency.value = 190;
      stop = at + dur + 0.6;
      break;
    }

    case "bell": {
      // vibraphone: near-pure sine plus a high partial. Almost no low-mid
      // energy at all, so ten notes can ring at once and you still hear each.
      osc("sine");
      osc("sine", 0, 4.01, 0.16);   // slightly inharmonic — gives it the "ting"
      osc("sine", 0, 9.2, 0.05);
      const decay = Math.min(dur + 1.2, 2.0);
      g.gain.linearRampToValueAtTime(gain * 1.2, at + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
      lp.frequency.value = 7000;
      hp.frequency.value = 200;     // nothing below the mud line survives
      stop = at + decay + 0.05;
      break;
    }

    case "clav": {
      // thin, bright, percussive — everything below 400Hz stripped. There is
      // nowhere for a muddy voicing to hide in this sound.
      osc("sawtooth", 0, 1, 0.7);
      osc("square", 5, 2, 0.2);
      const decay = Math.min(dur + 0.25, 0.8);
      g.gain.linearRampToValueAtTime(gain * 1.15, at + 0.003);
      g.gain.exponentialRampToValueAtTime(gain * 0.2, at + 0.12);
      g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
      lp.frequency.setValueAtTime(5000, at);
      lp.frequency.exponentialRampToValueAtTime(2200, at + decay);
      hp.frequency.value = 400;
      hp.Q.value = 0.8;
      stop = at + decay + 0.05;
      break;
    }

    default: {
      // rhodes — the original: triangle + sine, gently detuned, mellowing
      osc("triangle");
      osc("sine", 6);
      g.gain.linearRampToValueAtTime(gain, at + 0.012);
      g.gain.exponentialRampToValueAtTime(gain * 0.5, at + 0.14);
      g.gain.setValueAtTime(gain * 0.5, at + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      lp.frequency.setValueAtTime(3000, at);
      lp.frequency.exponentialRampToValueAtTime(1400, at + dur);
      hp.frequency.value = 140;
      break;
    }
  }

  g.connect(hp);
  hp.connect(lp);
  lp.connect(dest);
  oscs.forEach((o) => { o.start(at); o.stop(stop); });
}

/** Play a chord now — optionally rolled bottom-to-top like a real hand. */
export function playChord(midis: number[], opts: { roll?: boolean; dur?: number } = {}) {
  const ac = getCtx();
  const master = bus(ac);

  const dur = opts.dur ?? 1.7;
  const sorted = [...midis].sort((a, b) => a - b);
  const g = polyGain(0.34, sorted.length);
  sorted.forEach((m, i) => {
    const at = ac.currentTime + (opts.roll ? i * 0.045 : 0);
    voice(ac, master, m, at, dur, g);
  });
}

/**
 * Play notes in the order given — order matters for enclosures, where the whole
 * point is that you go above, then below, then land.
 */
export function playSequence(midis: number[], step = 0.17) {
  const ac = getCtx();
  const master = bus(ac);
  midis.forEach((m, i) => {
    voice(ac, master, m, ac.currentTime + i * step, step * 2.2, 0.17);
  });
}

/** Run a scale up (and optionally back down) — one note at a time. */
export function playScale(midis: number[], opts: { updown?: boolean } = {}) {
  const ac = getCtx();
  const master = bus(ac);

  const asc = [...midis].sort((a, b) => a - b);
  const seq = opts.updown ? [...asc, ...asc.slice(0, -1).reverse()] : asc;
  const step = 0.16;
  seq.forEach((m, i) => {
    voice(ac, master, m, ac.currentTime + i * step, step * 1.9, 0.15);
  });
}

export type ProgressionHandle = { stop: () => void };

/** A single note — for stepping around the keyboard or the neck by hand. */
export function playNote(midi: number) {
  const ac = getCtx();
  const master = bus(ac);
  voice(ac, master, midi, ac.currentTime, 0.7, 0.3);
}

/**
 * Play an exercise line with the chords comping underneath, so you hear the
 * line land on its targets exactly as the chords change.
 *
 * Each chord always lasts one bar; `notesPerChord` just decides how finely that
 * bar is divided — 8 for eighth-note runs, 2 for a guide-tone line in halves.
 */
export function playLine(
  line: number[],
  chordVoicings: number[][],
  notesPerChord: number,
  bpm: number,
  onStep: (i: number) => void,
  onEnd: () => void,
): ProgressionHandle {
  const ac = getCtx();
  const master = bus(ac);

  const bar = 240 / bpm;                 // four beats
  const noteDur = bar / Math.max(notesPerChord, 1);
  const start = ac.currentTime + 0.08;
  let cancelled = false;
  const timers: ReturnType<typeof setTimeout>[] = [];

  // chords, quiet, underneath
  chordVoicings.forEach((midis, c) => {
    const at = start + c * bar;
    const g = polyGain(0.17, midis.length); // sits under the line
    midis.forEach((m, j) => {
      voice(ac, master, m, at + j * 0.015, bar * 0.95, g);
    });
  });

  // the line on top
  line.forEach((m, i) => {
    const at = start + i * noteDur;
    voice(ac, master, m, at, noteDur * 1.6, 0.19);
    timers.push(
      setTimeout(() => {
        if (!cancelled) onStep(i);
      }, (at - ac.currentTime) * 1000),
    );
  });

  timers.push(
    setTimeout(() => {
      if (!cancelled) onEnd();
    }, (start + line.length * noteDur - ac.currentTime) * 1000),
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
  const master = bus(ac);

  const beat = 60 / bpm;
  const step = beat * 2; // one chord per half-bar
  const start = ac.currentTime + 0.06;
  let cancelled = false;
  const timers: ReturnType<typeof setTimeout>[] = [];

  chords.forEach((midis, i) => {
    const at = start + i * step;
    const g = polyGain(0.33, midis.length);
    [...midis].sort((a, b) => a - b).forEach((m, j) => {
      voice(ac, master, m, at + j * 0.02, step * 0.95, g);
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

// ---------------------------------------------------------------------------
// Groove playback — the same events the MIDI export writes, so what you hear
// is exactly what lands in your DAW.
// ---------------------------------------------------------------------------

export function playGroove(
  events: GrooveEvent[],
  bpm: number,
  totalBeats: number,
  onHit: (chordIndex: number, step: number) => void,
  onEnd: () => void,
  melody?: { midi: number; beat: number; durBeats: number; velocity: number }[],
): ProgressionHandle {
  const ac = getCtx();
  const master = bus(ac);

  const spb = 60 / bpm; // seconds per beat
  const start = ac.currentTime + 0.08;
  let cancelled = false;
  const timers: ReturnType<typeof setTimeout>[] = [];

  for (const e of events) {
    const at = start + e.beat * spb;
    const dur = e.durBeats * spb;
    // roll the voicing very slightly, like a hand
    const g = polyGain(0.36, e.midis.length) * e.velocity;
    [...e.midis].sort((a, b) => a - b).forEach((m, j) => {
      voice(ac, master, m, at + j * 0.006, dur, g);
    });
    timers.push(
      setTimeout(() => {
        if (!cancelled) onHit(e.chordIndex, e.step);
      }, (at - ac.currentTime) * 1000),
    );
  }

  for (const n of melody ?? []) {
    voice(ac, master, n.midi, start + n.beat * spb, n.durBeats * spb, 0.3 * n.velocity);
  }

  timers.push(
    setTimeout(
      () => { if (!cancelled) onEnd(); },
      (start + totalBeats * spb - ac.currentTime) * 1000,
    ),
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
