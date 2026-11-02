/**
 * Synthesises the placeholder soundtrack into public/audio/ (WebM/Opus + MP3).
 *
 *   npx tsx scripts/generate-audio.ts
 *
 * Everything here is generated from code (no samples), so the output is our own
 * work, released under CC0. It imitates tar, kamança, balaban, zurna, nağara,
 * qanun and daf in the Şur mode, and is meant to be replaced by real CC0
 * recordings later (see docs/AUDIO_CREDITS.md). MP3 is encoded with lamejs, WebM/Opus
 * by Chromium's MediaRecorder through Playwright (both are dev dependencies).
 */
import fs from "node:fs";
import path from "node:path";
import type { Mp3Encoder as Mp3EncoderType } from "@breezystack/lamejs";
import { chromium } from "@playwright/test";
import { AUDIO_SPRITE, MUSIC_LAYERS, AMBIENCE_LAYERS, type SfxName } from "../src/features/audio/manifest";

const SR = 32000;
const OUT = path.join(process.cwd(), "public", "audio");

// ---------------------------------------------------------------- DSP helpers
type Buf = Float32Array;
const buf = (sec: number): Buf => new Float32Array(Math.ceil(sec * SR));
const TAU = Math.PI * 2;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mix(dst: Buf, src: Buf, atSec: number, gain = 1) {
  const o = Math.round(atSec * SR);
  for (let i = 0; i < src.length && o + i < dst.length; i++) if (o + i >= 0) dst[o + i]! += src[i]! * gain;
}

function lowpass(x: Buf, fc: number): Buf {
  const a = 1 - Math.exp((-TAU * fc) / SR);
  let y = 0;
  for (let i = 0; i < x.length; i++) x[i] = y += a * (x[i]! - y);
  return x;
}

/** RBJ band-pass (constant peak gain), in place. */
function bandpass(x: Buf, fc: number | ((i: number) => number), q: number): Buf {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const f = typeof fc === "number" ? fc : fc(i);
    const w = (TAU * Math.min(f, SR * 0.45)) / SR;
    const alpha = Math.sin(w) / (2 * q);
    const a0 = 1 + alpha;
    const b0 = alpha / a0, b2 = -alpha / a0, a1 = (-2 * Math.cos(w)) / a0, a2 = (1 - alpha) / a0;
    const y = b0 * x[i]! + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]!; y2 = y1; y1 = y;
    x[i] = y;
  }
  return x;
}

function noise(sec: number, r: () => number): Buf {
  const b = buf(sec);
  for (let i = 0; i < b.length; i++) b[i] = r() * 2 - 1;
  return b;
}

function envelope(b: Buf, attack: number, release: number) {
  const a = Math.max(1, attack * SR), r = Math.max(1, release * SR);
  for (let i = 0; i < b.length; i++) {
    const fromEnd = b.length - i;
    b[i]! *= Math.min(1, i / a) * Math.min(1, fromEnd / r);
  }
  return b;
}

function normalize(b: Buf, peak = 0.85): Buf {
  let m = 0;
  for (const v of b) m = Math.max(m, Math.abs(v));
  if (m > 0) for (let i = 0; i < b.length; i++) b[i]! *= peak / m;
  return b;
}

/** Fades the head and tail so the engine can crossfade one pass into the next. */
function loopable(b: Buf, fade = 1.2) {
  return envelope(b, fade, fade);
}

// ---------------------------------------------------------------- instruments
// Şur mode on D with a lowered 2nd (a quarter tone between E♭ and E).
const SHUR = [0, 1.5, 3, 5, 7, 8, 10, 12, 13.5, 15, 17, 19];
const D3 = 146.83;
const hz = (degree: number, octave = 0, base = D3) => {
  const n = SHUR.length - 4; // 8 steps per octave
  const o = Math.floor(degree / n) + octave;
  const d = ((degree % n) + n) % n;
  return base * Math.pow(2, (SHUR[d]! + 12 * o) / 12);
};

/** Karplus–Strong string; tar uses a doubled, slightly detuned course. */
function pluck(freq: number, sec: number, r: () => number, { decay = 0.996, bright = 0.6, course = true } = {}): Buf {
  const out = buf(sec);
  for (const f of course ? [freq, freq * 1.0035] : [freq]) {
    const n = Math.max(2, Math.round(SR / f));
    const line = new Float32Array(n);
    let lp = 0;
    for (let i = 0; i < n; i++) line[i] = lp += bright * (r() * 2 - 1 - lp);
    let idx = 0;
    for (let i = 0; i < out.length; i++) {
      const next = (idx + 1) % n;
      const v = line[idx]!;
      out[i]! += v;
      line[idx] = decay * 0.5 * (v + line[next]!);
      idx = next;
    }
  }
  return envelope(out, 0.002, 0.05);
}

/** Tar tremolo on a held note: fast repeated plucks. */
function tremolo(freq: number, sec: number, r: () => number, rate = 11): Buf {
  const out = buf(sec + 0.6);
  for (let t = 0; t < sec; t += 1 / rate) mix(out, pluck(freq, 0.5, r, { decay: 0.994, bright: 0.7 }), t, 0.55 + 0.25 * r());
  return out;
}

interface Voice {
  harmonics: number[];
  vibratoHz: number;
  vibratoDepth: number;
  attack: number;
  release: number;
  breath: number;
  lowpass: number;
  formant?: [number, number];
}

const KAMANCHA: Voice = { harmonics: [1, 0.55, 0.4, 0.3, 0.22, 0.16, 0.12, 0.09, 0.07, 0.05], vibratoHz: 5.6, vibratoDepth: 0.007, attack: 0.18, release: 0.25, breath: 0.03, lowpass: 3200, formant: [900, 1.2] };
const BALABAN: Voice = { harmonics: [1, 0.08, 0.38, 0.05, 0.16, 0.03, 0.07], vibratoHz: 4.6, vibratoDepth: 0.005, attack: 0.12, release: 0.3, breath: 0.05, lowpass: 1900 };
const ZURNA: Voice = { harmonics: [1, 0.8, 0.75, 0.6, 0.55, 0.45, 0.4, 0.33, 0.28, 0.22, 0.18, 0.14], vibratoHz: 6.2, vibratoDepth: 0.006, attack: 0.03, release: 0.08, breath: 0.04, lowpass: 5200, formant: [1500, 1.4] };

/** Additive sustained voice with vibrato and an optional glide from the previous pitch. */
function sustained(v: Voice, freq: number, sec: number, r: () => number, from?: number): Buf {
  const out = buf(sec);
  let phase = 0;
  const glide = from ? 0.12 * SR : 0;
  const vibDelay = 0.25 * SR;
  for (let i = 0; i < out.length; i++) {
    const g = glide && i < glide ? from! + (freq - from!) * (i / glide) : freq;
    const vib = 1 + v.vibratoDepth * Math.min(1, i / vibDelay) * Math.sin((TAU * v.vibratoHz * i) / SR);
    phase += (TAU * g * vib) / SR;
    let s = 0;
    for (let h = 0; h < v.harmonics.length; h++) s += v.harmonics[h]! * Math.sin(phase * (h + 1));
    out[i] = s + v.breath * (r() * 2 - 1);
  }
  lowpass(out, v.lowpass);
  if (v.formant) {
    const body = bandpass(Float32Array.from(out), v.formant[0], v.formant[1]);
    for (let i = 0; i < out.length; i++) out[i] = out[i]! * 0.6 + body[i]! * 0.8;
  }
  return envelope(out, v.attack, v.release);
}

function drum(kind: "nagara" | "tak" | "daf", r: () => number): Buf {
  const spec = {
    nagara: { f0: 115, f1: 62, drop: 0.12, decay: 0.2, len: 0.7, slap: 0.25, slapHz: 1800 },
    tak: { f0: 340, f1: 300, drop: 0.03, decay: 0.05, len: 0.2, slap: 0.5, slapHz: 3200 },
    daf: { f0: 190, f1: 130, drop: 0.05, decay: 0.11, len: 0.45, slap: 0.35, slapHz: 2400 },
  }[kind];
  const out = buf(spec.len);
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const f = spec.f1 + (spec.f0 - spec.f1) * Math.exp(-t / spec.drop);
    phase += (TAU * f) / SR;
    out[i] = Math.sin(phase) * Math.exp(-t / spec.decay);
  }
  const slap = bandpass(noise(0.03, r), spec.slapHz, 0.9);
  envelope(slap, 0.001, 0.025);
  mix(out, slap, 0, spec.slap * 3);
  if (kind === "daf") {
    const jingles = bandpass(noise(0.25, r), 7000, 2);
    for (let i = 0; i < jingles.length; i++) jingles[i]! *= Math.exp(-i / SR / 0.07);
    mix(out, jingles, 0.005, 1.4);
  }
  return out;
}

type Note = [degree: number, beats: number, octave?: number];

function melody(notes: Note[], bpm: number, play: (f: number, sec: number, prev?: number) => Buf, total: number, start = 0, gain = 1, dst?: Buf): Buf {
  const out = dst ?? buf(total);
  const beat = 60 / bpm;
  let t = start;
  let prev: number | undefined;
  for (const [deg, beats, oct = 0] of notes) {
    if (deg >= -20) {
      const f = hz(deg, oct);
      mix(out, play(f, beats * beat * 0.98, prev), t, gain);
      prev = f;
    }
    t += beats * beat;
  }
  return out;
}

const REST = -99;

// ---------------------------------------------------------------- music layers
function drone(sec: number, r: () => number): Buf {
  const out = buf(sec);
  const parts: [number, number][] = [[73.42, 0.5], [73.62, 0.35], [110.0, 0.3], [146.83, 0.22], [220.0, 0.08]];
  for (const [f, a] of parts) {
    let ph = r() * TAU;
    for (let i = 0; i < out.length; i++) {
      ph += (TAU * f) / SR;
      const swell = 0.75 + 0.25 * Math.sin((TAU * 0.06 * i) / SR + f);
      out[i]! += a * swell * (Math.sin(ph) + 0.3 * Math.sin(2 * ph) + 0.15 * Math.sin(3 * ph));
    }
  }
  return lowpass(out, 900);
}

function layerPeace(sec: number, r: () => number): Buf {
  const tar = (f: number, s: number) => (s > 0.9 ? tremolo(f * 2, s, r) : pluck(f * 2, s + 0.6, r));
  const kam = (f: number, s: number, p?: number) => sustained(KAMANCHA, f, s, r, p);
  const out = buf(sec);
  const A: Note[] = [[0, 1], [1, 0.5], [2, 0.5], [3, 2], [2, 0.5], [1, 0.5], [2, 1], [0, 2], [REST, 1], [2, 1], [3, 0.5], [4, 0.5], [5, 2], [4, 1], [3, 1], [2, 1], [1, 1], [0, 3]];
  melody(A, 72, tar, sec, 0.6, 0.55, out);
  const B: Note[] = [[REST, 4], [4, 3], [3, 1], [2, 2], [1, 2], [REST, 4], [5, 3], [4, 1], [3, 2], [2, 1], [1, 1], [0, 4]];
  melody(B, 72, kam, sec, 0.6, 0.35, out);
  return out;
}

function layerKamancha(sec: number, r: () => number): Buf {
  const kam = (f: number, s: number, p?: number) => sustained(KAMANCHA, f, s, r, p);
  const N: Note[] = [[4, 3], [3, 1], [2, 1.5], [1, 0.5], [2, 3], [REST, 1], [1, 1], [0, 1], [1, 2], [2, 1], [1, 1], [0, 4], [REST, 1], [3, 2], [2, 1], [1, 1], [0, 3]];
  return melody(N, 58, kam, sec, 0.5, 0.6);
}

function layerBalaban(sec: number, r: () => number): Buf {
  const bal = (f: number, s: number, p?: number) => sustained(BALABAN, f, s, r, p);
  const N: Note[] = [[2, 3, -1], [1, 1, -1], [0, 2, -1], [REST, 1], [3, 2, -1], [2, 1, -1], [1, 1, -1], [2, 2, -1], [1, 1, -1], [0, 4, -1], [REST, 1], [4, 2, -1], [3, 2, -1], [2, 1, -1], [1, 1, -1], [0, 4, -1]];
  return melody(N, 54, bal, sec, 0.5, 0.65);
}

function layerBattle(sec: number, r: () => number): Buf {
  const out = buf(sec);
  const bpm = 132;
  const eighth = 60 / bpm / 2;
  // 6/8: D . T D T . | D . T D T T
  const pat = ["D", "", "T", "D", "T", "", "D", "", "T", "D", "T", "T"];
  const nag = drum("nagara", r), tak = drum("tak", r);
  for (let i = 0, t = 0.4; t < sec - 0.8; i++, t += eighth) {
    const hit = pat[i % pat.length];
    if (hit === "D") mix(out, nag, t, 0.9 + 0.1 * r());
    if (hit === "T") mix(out, tak, t, 0.45 + 0.1 * r());
  }
  const z = (f: number, s: number, p?: number) => sustained(ZURNA, f * 2, s, r, p && p * 2);
  const motif: Note[] = [[4, 1], [5, 0.5], [4, 0.5], [3, 1], [4, 1], [REST, 0.5], [4, 0.5], [5, 0.5], [6, 0.5], [7, 2], [6, 0.5], [5, 0.5], [4, 1], [3, 1], [4, 2], [REST, 2]];
  melody([...motif, ...motif, ...motif], bpm, z, sec, 2.2, 0.32, out);
  return out;
}

function layerFestive(sec: number, r: () => number): Buf {
  const out = buf(sec);
  const bpm = 108;
  const eighth = 60 / bpm / 2;
  const pat = ["D", "", "t", "t", "D", "", "t", ""];
  const daf = drum("daf", r), tak = drum("tak", r), nag = drum("nagara", r);
  for (let i = 0, t = 0.5; t < sec - 0.6; i++, t += eighth) {
    const hit = pat[i % pat.length];
    if (hit === "D") mix(out, daf, t, 0.7);
    if (hit === "t") mix(out, tak, t, 0.25);
    if (i % 16 === 0) mix(out, nag, t, 0.5);
  }
  const tar = (f: number, s: number) => (s > 0.6 ? tremolo(f * 2, s, r, 13) : pluck(f * 2, s + 0.5, r, { bright: 0.75 }));
  const tune: Note[] = [[0, 0.5], [2, 0.5], [4, 0.5], [5, 0.5], [4, 1], [3, 0.5], [2, 0.5], [3, 1], [4, 1], [2, 2], [4, 0.5], [5, 0.5], [7, 1], [5, 0.5], [4, 0.5], [3, 1], [2, 1], [0, 2]];
  melody([...tune, ...tune, ...tune], bpm, tar, sec, 1.0, 0.5, out);
  return out;
}

function layerJourney(sec: number, r: () => number): Buf {
  const out = buf(sec);
  const bpm = 96;
  const beat = 60 / bpm;
  const daf = drum("daf", r);
  for (let t = 0.4; t < sec - 0.6; t += beat) {
    mix(out, daf, t, 0.45);
    mix(out, daf, t + beat * 0.33, 0.25);
  }
  const ost: Note[] = [[0, 0.5], [4, 0.5], [3, 0.5], [4, 0.5]];
  const tar = (f: number, s: number) => pluck(f, s + 0.4, r, { bright: 0.55 });
  const seq: Note[] = Array.from({ length: Math.floor((sec - 1) / (beat * 2)) }, () => ost).flat();
  melody(seq, bpm, tar, sec, 0.4, 0.4, out);
  const kam = (f: number, s: number, p?: number) => sustained(KAMANCHA, f * 2, s, r, p && p * 2);
  melody([[REST, 8], [4, 4], [3, 2], [2, 2], [REST, 6], [2, 4], [1, 2], [0, 4]], bpm, kam, sec, 0.4, 0.22, out);
  return out;
}

function layerQanun(sec: number, r: () => number): Buf {
  const q = (f: number, s: number) => pluck(f * 2, s + 1.2, r, { decay: 0.9975, bright: 0.9, course: false });
  const up: Note[] = [[0, 0.5], [2, 0.5], [4, 0.5], [7, 0.5], [4, 0.5], [2, 0.5]];
  const alt: Note[] = [[1, 0.5], [3, 0.5], [5, 0.5], [8, 0.5], [5, 0.5], [3, 0.5]];
  const end: Note[] = [[2, 0.5], [1, 0.5], [0, 2]];
  const seq: Note[] = [...up, ...up, ...alt, ...alt, ...up, ...end, [REST, 1], ...up, ...alt, ...up, ...end];
  return melody(seq, 80, q, sec, 0.5, 0.5);
}

// ---------------------------------------------------------------- ambience
function windAmb(sec: number, r: () => number): Buf {
  const lfo = (i: number) => 450 + 300 * Math.sin((TAU * 0.07 * i) / SR) + 150 * Math.sin((TAU * 0.19 * i) / SR + 1);
  const out = bandpass(noise(sec, r), lfo, 1.4);
  for (let i = 0; i < out.length; i++) out[i]! *= 0.6 + 0.4 * Math.sin((TAU * 0.11 * i) / SR);
  return out;
}

function crowdAmb(sec: number, r: () => number, density = 26): Buf {
  const out = buf(sec);
  for (let v = 0; v < density; v++) {
    const formant = 500 + r() * 1400;
    for (let t = r() * 1.5; t < sec; t += 0.18 + r() * 0.5) {
      const syl = bandpass(noise(0.12 + r() * 0.12, r), formant * (0.85 + r() * 0.3), 4);
      envelope(syl, 0.03, 0.06);
      mix(out, syl, t, 0.4 + 0.6 * r());
    }
  }
  return lowpass(out, 2600);
}

function hoovesAmb(sec: number, r: () => number): Buf {
  const out = windAmb(sec, r);
  for (let i = 0; i < out.length; i++) out[i]! *= 0.2;
  const hit = () => {
    const click = bandpass(noise(0.03, r), 1100 + r() * 300, 3);
    envelope(click, 0.001, 0.02);
    const thump = buf(0.08);
    for (let i = 0; i < thump.length; i++) thump[i] = Math.sin((TAU * 90 * i) / SR) * Math.exp(-i / SR / 0.025);
    mix(thump, click, 0, 2.5);
    return thump;
  };
  for (let horse = 0; horse < 3; horse++) {
    const gain = 0.9 - horse * 0.25;
    for (let t = 0.2 + horse * 0.17; t < sec - 0.4; t += 0.5 + r() * 0.04) {
      mix(out, hit(), t, gain);
      mix(out, hit(), t + 0.09, gain * 0.8);
      mix(out, hit(), t + 0.2, gain * 0.9);
    }
  }
  return out;
}

function marketAmb(sec: number, r: () => number): Buf {
  const out = crowdAmb(sec, r, 18);
  for (let t = 0.5; t < sec - 0.5; t += 0.8 + r() * 2.2) {
    const clink = buf(0.3);
    const base = 2200 + r() * 1200;
    for (const [m, a] of [[1, 1], [1.47, 0.6], [2.09, 0.4]] as const)
      for (let i = 0; i < clink.length; i++) clink[i]! += a * Math.sin((TAU * base * m * i) / SR) * Math.exp(-i / SR / 0.06);
    mix(out, clink, t, 0.12 + 0.1 * r());
  }
  for (let t = 2; t < sec - 2; t += 5 + r() * 4) {
    const call = sustained({ ...BALABAN, breath: 0.15, lowpass: 1400, formant: [700, 2] }, 220 + r() * 60, 1.1, r, 260);
    mix(out, call, t, 0.08);
  }
  return out;
}

// ---------------------------------------------------------------- sfx
function sfx(name: SfxName, r: () => number): Buf {
  switch (name) {
    case "whoosh": {
      const len = 0.9;
      const b = bandpass(noise(len, r), (i) => 300 + 2200 * Math.sin((Math.PI * i) / (len * SR)), 1.1);
      for (let i = 0; i < b.length; i++) b[i]! *= Math.sin((Math.PI * i) / b.length) ** 2;
      return b;
    }
    case "sword": {
      const b = buf(1.1);
      for (const [m, a, d] of [[1, 1, 0.5], [2.76, 0.6, 0.3], [5.4, 0.4, 0.18], [8.93, 0.25, 0.1]] as const)
        for (let i = 0; i < b.length; i++) b[i]! += a * Math.sin((TAU * 820 * m * i) / SR) * Math.exp(-i / SR / d);
      const scrape = bandpass(noise(0.15, r), 4200, 1.5);
      envelope(scrape, 0.002, 0.1);
      mix(b, scrape, 0, 1.5);
      return b;
    }
    case "cannon": {
      const b = buf(1.9);
      let ph = 0;
      for (let i = 0; i < b.length; i++) {
        const t = i / SR;
        ph += (TAU * (35 + 25 * Math.exp(-t / 0.2))) / SR;
        b[i] = Math.sin(ph) * Math.exp(-t / 0.45);
      }
      const rumble = lowpass(noise(1.9, r), 380);
      for (let i = 0; i < rumble.length; i++) rumble[i]! *= Math.exp(-i / SR / 0.6);
      mix(b, rumble, 0, 2.5);
      const crack = bandpass(noise(0.04, r), 2500, 0.7);
      mix(b, crack, 0, 1.2);
      return b;
    }
    case "drum":
      return drum("nagara", r);
    case "page": {
      const b = buf(0.45);
      for (const t of [0, 0.11, 0.24]) {
        const c = bandpass(noise(0.12, r), 3500 + r() * 2000, 0.8);
        envelope(c, 0.005, 0.08);
        mix(b, c, t, 0.6 + 0.4 * r());
      }
      return b;
    }
    case "chime": {
      const b = buf(1.8);
      for (const [m, a] of [[1, 1], [2.0, 0.5], [2.76, 0.35], [5.4, 0.15]] as const)
        for (let i = 0; i < b.length; i++) b[i]! += a * Math.sin((TAU * 880 * m * i) / SR) * Math.exp(-i / SR / (0.7 / m));
      return b;
    }
    case "victory": {
      const out = buf(2.2);
      const z = (f: number, s: number, p?: number) => sustained(ZURNA, f * 2, s, r, p && p * 2);
      melody([[4, 0.5], [5, 0.5], [7, 1.5]], 120, z, 2.2, 0.05, 0.6, out);
      mix(out, drum("nagara", r), 0.05, 0.8);
      mix(out, drum("nagara", r), 0.55, 0.8);
      return out;
    }
  }
}

// ---------------------------------------------------------------- encoding
function toInt16(b: Buf): Int16Array {
  const out = new Int16Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = Math.max(-1, Math.min(1, b[i]!)) * 32767;
  return out;
}

let Mp3Encoder: typeof Mp3EncoderType;

function mp3(b: Buf, kbps: number): Buffer {
  const enc = new Mp3Encoder(1, SR, kbps);
  const pcm = toInt16(b);
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < pcm.length; i += 1152) chunks.push(enc.encodeBuffer(pcm.subarray(i, i + 1152)));
  chunks.push(enc.flush());
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

function wav(b: Buf): Buffer {
  const pcm = toInt16(b);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length * 2, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length * 2, 40);
  return Buffer.concat([h, Buffer.from(pcm.buffer)]);
}

/** Real-time WebM/Opus encoding in headless Chromium; clips are encoded in parallel pages. */
async function webmAll(clips: { name: string; data: Buf; kbps: number }[]): Promise<Map<string, Buffer>> {
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const result = new Map<string, Buffer>();
  await Promise.all(
    clips.map(async ({ name, data, kbps }) => {
      const page = await browser.newPage();
      await page.route("https://audio.local/**", (route) =>
        route.request().url().endsWith(".wav")
          ? route.fulfill({ body: wav(data), contentType: "audio/wav" })
          : route.fulfill({ body: "<!doctype html><title>enc</title>", contentType: "text/html" }),
      );
      await page.goto("https://audio.local/");
      const b64 = await page.evaluate(async (bits) => {
        const ctx = new AudioContext({ sampleRate: 48000 });
        const audio = await ctx.decodeAudioData(await (await fetch("/clip.wav")).arrayBuffer());
        const dest = ctx.createMediaStreamDestination();
        dest.channelCount = 1;
        const src = ctx.createBufferSource();
        src.buffer = audio;
        src.connect(dest);
        const rec = new MediaRecorder(dest.stream, { mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: bits * 1000 });
        const parts: Blob[] = [];
        rec.ondataavailable = (e) => parts.push(e.data);
        const done = new Promise((r) => (rec.onstop = r));
        rec.start();
        src.start();
        await new Promise((r) => (src.onended = r));
        await new Promise((r) => setTimeout(r, 150));
        rec.stop();
        await done;
        const bytes = new Uint8Array(await new Blob(parts, { type: "audio/webm" }).arrayBuffer());
        let s = "";
        for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return btoa(s);
      }, kbps);
      result.set(name, Buffer.from(b64, "base64"));
      await page.close();
    }),
  );
  await browser.close();
  return result;
}

// ---------------------------------------------------------------- main
const MUSIC_BUILDERS: Record<string, (sec: number, r: () => number) => Buf> = {
  base: drone,
  peace: layerPeace,
  kamancha: layerKamancha,
  balaban: layerBalaban,
  battle: layerBattle,
  festive: layerFestive,
  journey: layerJourney,
  qanun: layerQanun,
};
const AMBIENCE_BUILDERS: Record<string, (sec: number, r: () => number) => Buf> = {
  wind: windAmb,
  crowd: crowdAmb,
  hooves: hoovesAmb,
  market: marketAmb,
};

async function main() {
  // lamejs ships ESM; tsx runs this file as CommonJS, so load it with a real dynamic import.
  ({ Mp3Encoder } = await import("@breezystack/lamejs"));
  fs.mkdirSync(OUT, { recursive: true });
  const clips: { name: string; data: Buf; kbps: number }[] = [];
  let seed = 1;
  for (const [id, layer] of Object.entries(MUSIC_LAYERS)) {
    const build = MUSIC_BUILDERS[id];
    if (!build) throw new Error(`no builder for music layer ${id}`);
    clips.push({ name: layer.file, data: normalize(loopable(build(layer.seconds, rng(seed++)))), kbps: 56 });
  }
  for (const [id, layer] of Object.entries(AMBIENCE_LAYERS)) {
    const build = AMBIENCE_BUILDERS[id];
    if (!build) throw new Error(`no builder for ambience ${id}`);
    clips.push({ name: layer.file, data: normalize(loopable(build(layer.seconds, rng(seed++)), 1.5), 0.7), kbps: 40 });
  }
  // SFX sprite: every sound at its fixed offset from the manifest.
  const spriteEnd = Math.max(...Object.values(AUDIO_SPRITE.sprite).map(([o, d]) => o + d)) / 1000;
  const sprite = buf(spriteEnd + 0.1);
  for (const [name, [offset]] of Object.entries(AUDIO_SPRITE.sprite))
    mix(sprite, normalize(sfx(name as SfxName, rng(seed++)), 0.8), offset / 1000);
  clips.push({ name: AUDIO_SPRITE.file, data: sprite, kbps: 48 });

  for (const c of clips) fs.writeFileSync(path.join(OUT, `${c.name}.mp3`), mp3(c.data, c.kbps));
  const webm = await webmAll(clips);
  for (const [name, data] of webm) fs.writeFileSync(path.join(OUT, `${name}.webm`), data);

  let total = 0;
  for (const f of fs.readdirSync(OUT)) total += fs.statSync(path.join(OUT, f)).size;
  console.log(`audio → public/audio/: ${clips.length} clips, ${(total / 1024 / 1024).toFixed(1)} MB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
