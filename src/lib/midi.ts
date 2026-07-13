// ---------------------------------------------------------------------------
// midi.ts — write a Standard MIDI File by hand.
//
// No dependency: an SMF is just bytes. A header chunk, then track chunks of
// delta-time-prefixed events. We write format 1 (parallel tracks) so the chords
// and the solo line land on separate tracks — drop it into a DAW and they're
// already split for you.
// ---------------------------------------------------------------------------

import type { GrooveEvent } from "./groove";

const TPQ = 480; // ticks per quarter note
const BAR = TPQ * 4;

/** MIDI variable-length quantity — 7 bits per byte, high bit = "more coming" */
function vlq(n: number): number[] {
  const out = [n & 0x7f];
  n >>= 7;
  while (n > 0) {
    out.unshift((n & 0x7f) | 0x80);
    n >>= 7;
  }
  return out;
}

const str = (s: string) => [...s].map((c) => c.charCodeAt(0));
const u32 = (n: number) => [(n >> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255];
const u16 = (n: number) => [(n >> 8) & 255, n & 255];

type Ev = { tick: number; data: number[] };

function chunk(id: string, body: number[]): number[] {
  return [...str(id), ...u32(body.length), ...body];
}

/** Turn absolute-time events into a delta-encoded track chunk. */
function track(events: Ev[], name: string, tempoBpm?: number): number[] {
  const body: number[] = [];

  // track name
  const nm = str(name);
  body.push(...vlq(0), 0xff, 0x03, ...vlq(nm.length), ...nm);

  if (tempoBpm) {
    const usPerQuarter = Math.round(60_000_000 / tempoBpm);
    body.push(
      ...vlq(0), 0xff, 0x51, 0x03,
      (usPerQuarter >> 16) & 255, (usPerQuarter >> 8) & 255, usPerQuarter & 255,
    );
  }

  // note-off must come before note-on at the same tick, or a repeated note
  // gets cut dead by its own predecessor
  const sorted = [...events].sort(
    (a, b) => a.tick - b.tick || (a.data[0] & 0xf0) - (b.data[0] & 0xf0),
  );

  let last = 0;
  for (const e of sorted) {
    body.push(...vlq(e.tick - last), ...e.data);
    last = e.tick;
  }

  body.push(...vlq(0), 0xff, 0x2f, 0x00); // end of track
  return chunk("MTrk", body);
}

function notes(midis: number[], at: number, dur: number, ch: number, vel: number): Ev[] {
  const out: Ev[] = [];
  for (const m of midis) {
    if (m < 0 || m > 127) continue;
    out.push({ tick: at, data: [0x90 | ch, m, vel] });
    out.push({ tick: at + dur, data: [0x80 | ch, m, 0] });
  }
  return out;
}

function file(tracks: number[][]): Uint8Array {
  const header = chunk("MThd", [...u16(1), ...u16(tracks.length), ...u16(TPQ)]);
  return new Uint8Array([...header, ...tracks.flat()]);
}

/** Just the chords — one bar each. */
export function progressionToMidi(voicings: number[][], bpm: number, name: string): Uint8Array {
  const evs: Ev[] = [];
  voicings.forEach((v, i) => {
    evs.push(...notes(v, i * BAR, Math.round(BAR * 0.96), 0, 80));
  });
  return file([track(evs, name, bpm)]);
}

/**
 * Chords on one track, the solo line on another — so you can mute either one
 * and practise against the other.
 */
export function exerciseToMidi(
  line: number[],
  voicings: number[][],
  notesPerChord: number,
  bpm: number,
  name: string,
): Uint8Array {
  const chordEvs: Ev[] = [];
  voicings.forEach((v, i) => {
    chordEvs.push(...notes(v, i * BAR, Math.round(BAR * 0.96), 0, 62));
  });

  const step = Math.round(BAR / Math.max(notesPerChord, 1));
  const lineEvs: Ev[] = [];
  line.forEach((m, i) => {
    lineEvs.push(...notes([m], i * step, Math.round(step * 0.92), 1, 96));
  });

  return file([
    track(chordEvs, `${name} — chords`, bpm),
    track(lineEvs, `${name} — line`),
  ]);
}

/**
 * The groove, exported. Swing, rests, accents and note-length all survive the
 * trip — this writes exactly the events the audio engine plays, so the file in
 * your DAW is the thing you were just listening to.
 */
export function grooveToMidi(
  events: GrooveEvent[],
  bpm: number,
  name: string,
  melody?: { midi: number; beat: number; durBeats: number; velocity: number }[],
): Uint8Array {
  const evs: Ev[] = [];
  for (const e of events) {
    const at = Math.round(e.beat * TPQ);
    const dur = Math.max(1, Math.round(e.durBeats * TPQ));
    const vel = Math.min(127, Math.max(1, Math.round(e.velocity * 127)));
    for (const m of e.midis) {
      if (m < 0 || m > 127) continue;
      evs.push({ tick: at, data: [0x90, m, vel] });
      evs.push({ tick: at + dur, data: [0x80, m, 0] });
    }
  }

  const tracks = [track(evs, `${name} — comp`, bpm)];

  if (melody?.length) {
    const mel: Ev[] = [];
    for (const n of melody) {
      const at = Math.round(n.beat * TPQ);
      const dur = Math.max(1, Math.round(n.durBeats * TPQ));
      const v = Math.min(127, Math.max(1, Math.round(n.velocity * 127)));
      mel.push({ tick: at, data: [0x91, n.midi, v] });
      mel.push({ tick: at + dur, data: [0x81, n.midi, 0] });
    }
    tracks.push(track(mel, `${name} — line`));
  }

  return file(tracks);
}

/** Hand the bytes to the browser as a download. */
export function downloadMidi(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as unknown as BlobPart], { type: "audio/midi" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".mid") ? filename : `${filename}.mid`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
