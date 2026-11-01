"use client";

import type { Howl as HowlType } from "howler";
import type { Mood } from "@/domain/schema";
import { BASE_PATH } from "@/lib/basePath";
import { channelLevel, isLightMode, type Settings } from "@/lib/settings";
import {
  AMBIENCE_LAYERS,
  AUDIO_SPRITE,
  MOOD_SOUND,
  MUSIC_CROSSFADE_MS,
  MUSIC_LAYERS,
  audioSources,
  type AmbienceLayer,
  type Channel,
  type Layer,
  type MusicLayer,
  type SfxName,
} from "./manifest";

type HowlerModule = typeof import("howler");

/**
 * A looping layer. Instead of the codec's native loop (MP3/Opus padding would
 * leave a gap), each pass is started again shortly before the previous one
 * ends and the two are crossfaded.
 */
class LoopLayer {
  private howl: HowlType | null = null;
  private ids: number[] = [];
  private timer: number | null = null;
  private target = 0;
  private playing = false;

  constructor(
    private readonly lib: HowlerModule,
    private readonly layer: Layer,
  ) {}

  private ensure(): HowlType {
    this.howl ??= new this.lib.Howl({
      src: audioSources(BASE_PATH, this.layer.file),
      format: ["webm", "mp3"],
      preload: true,
      html5: false,
    });
    return this.howl;
  }

  preload() {
    this.ensure();
  }

  /** Fades to `level` (0 stops the loop once silent). */
  setLevel(level: number, ms: number) {
    const target = level * this.layer.gain;
    if (target === this.target && (this.playing || target === 0)) return;
    this.target = target;
    const howl = this.ensure();
    if (target > 0 && !this.playing) {
      this.playing = true;
      this.startPass(ms);
      return;
    }
    for (const id of this.ids) howl.fade(howl.volume(id) as number, target, ms, id);
    if (target === 0) {
      this.playing = false;
      if (this.timer !== null) window.clearTimeout(this.timer);
      this.timer = null;
      const ids = this.ids;
      this.ids = [];
      window.setTimeout(() => ids.forEach((id) => howl.stop(id)), ms + 50);
    }
  }

  private startPass(fadeMs: number) {
    const howl = this.ensure();
    const run = () => {
      if (!this.playing) return;
      const id = howl.play();
      howl.volume(0, id);
      howl.fade(0, this.target, fadeMs, id);
      const previous = this.ids;
      this.ids = [id];
      for (const old of previous) {
        howl.fade(howl.volume(old) as number, 0, MUSIC_CROSSFADE_MS, old);
        window.setTimeout(() => howl.stop(old), MUSIC_CROSSFADE_MS + 50);
      }
      const length = (howl.duration() || this.layer.seconds) * 1000;
      this.timer = window.setTimeout(() => {
        fadeMs = MUSIC_CROSSFADE_MS;
        run();
      }, Math.max(1000, length - MUSIC_CROSSFADE_MS));
    };
    if (howl.state() === "loaded") run();
    else howl.once("load", run);
  }

  stop() {
    this.setLevel(0, 200);
  }
}

export class AudioEngine {
  private lib: HowlerModule | null = null;
  private loading: Promise<HowlerModule> | null = null;
  private music = new Map<MusicLayer, LoopLayer>();
  private ambience = new Map<AmbienceLayer, LoopLayer>();
  private sprite: HowlType | null = null;
  private voice: HowlType | null = null;
  private mood: Mood | null = null;
  private started = false;
  private settings: Settings | null = null;

  private async load(): Promise<HowlerModule> {
    this.loading ??= import("howler").then((m) => (this.lib = m));
    return this.loading;
  }

  get isStarted() {
    return this.started;
  }

  /** Must be called from a user gesture (browser autoplay rules). */
  async start(settings: Settings, mood: Mood) {
    const lib = await this.load();
    this.started = true;
    this.settings = settings;
    lib.Howler.autoUnlock = true;
    if (lib.Howler.ctx?.state === "suspended") await lib.Howler.ctx.resume().catch(() => {});
    this.sprite ??= new lib.Howl({
      src: audioSources(BASE_PATH, AUDIO_SPRITE.file),
      format: ["webm", "mp3"],
      sprite: AUDIO_SPRITE.sprite as unknown as Record<string, [number, number]>,
    });
    this.setMood(mood, true);
  }

  applySettings(settings: Settings) {
    this.settings = settings;
    if (!this.started || !this.lib) return;
    this.lib.Howler.mute(settings.muted);
    if (this.mood) this.mix(this.mood, 400);
    this.voice?.volume(channelLevel(settings, "voice"));
  }

  setMood(mood: Mood, immediate = false) {
    this.mood = mood;
    if (!this.started) return;
    this.mix(mood, immediate ? 900 : MUSIC_CROSSFADE_MS);
  }

  /** Warms up the files of an upcoming mood so the crossfade starts on time. */
  async preload(mood: Mood) {
    if (!this.started) return;
    const lib = await this.load();
    const want = MOOD_SOUND[mood];
    for (const id of want.music) this.layer(lib, "music", id).preload();
    if (!this.settings || !isLightMode(this.settings)) for (const id of want.ambience) this.layer(lib, "ambience", id).preload();
  }

  playSfx(name: SfxName) {
    if (!this.started || !this.sprite || !this.settings) return;
    const level = channelLevel(this.settings, "sfx");
    if (level === 0) return;
    const id = this.sprite.play(name);
    this.sprite.volume(level, id);
  }

  /** Narration playback on the voice channel. Returns the Howl so the caller can follow its position. */
  async playVoice(src: string): Promise<HowlType | null> {
    if (!this.settings) return null;
    const lib = await this.load();
    this.voice?.unload();
    const base = src.startsWith("/") ? `${BASE_PATH}${src}` : src;
    this.voice = new lib.Howl({ src: [`${base}.webm`, `${base}.mp3`], format: ["webm", "mp3"], html5: true });
    this.voice.volume(channelLevel(this.settings, "voice"));
    this.voice.play();
    return this.voice;
  }

  stopVoice() {
    this.voice?.stop();
  }

  stopAll() {
    for (const l of [...this.music.values(), ...this.ambience.values()]) l.stop();
    this.voice?.stop();
    this.mood = null;
  }

  private layer(lib: HowlerModule, kind: "music", id: MusicLayer): LoopLayer;
  private layer(lib: HowlerModule, kind: "ambience", id: AmbienceLayer): LoopLayer;
  private layer(lib: HowlerModule, kind: "music" | "ambience", id: string): LoopLayer {
    const map = (kind === "music" ? this.music : this.ambience) as Map<string, LoopLayer>;
    let l = map.get(id);
    if (!l) {
      const def = kind === "music" ? MUSIC_LAYERS[id as MusicLayer] : AMBIENCE_LAYERS[id as AmbienceLayer];
      l = new LoopLayer(lib, def);
      map.set(id, l);
    }
    return l;
  }

  private mix(mood: Mood, ms: number) {
    const lib = this.lib;
    const s = this.settings;
    if (!lib || !s) return;
    const want = MOOD_SOUND[mood];
    const light = isLightMode(s);
    const level = (c: Channel) => channelLevel(s, c);
    const musicOn = new Set<MusicLayer>(["base", ...want.music]);
    for (const id of Object.keys(MUSIC_LAYERS) as MusicLayer[]) {
      const on = musicOn.has(id);
      if (on || this.music.has(id)) this.layer(lib, "music", id).setLevel(on ? level("music") : 0, ms);
    }
    // Light mode drops ambience: fewer decoders and less CPU on weak machines.
    const ambOn = new Set<AmbienceLayer>(light ? [] : want.ambience);
    for (const id of Object.keys(AMBIENCE_LAYERS) as AmbienceLayer[]) {
      const on = ambOn.has(id);
      if (on || this.ambience.has(id)) this.layer(lib, "ambience", id).setLevel(on ? level("ambience") : 0, ms);
    }
  }
}

let engine: AudioEngine | null = null;
export function getAudioEngine(): AudioEngine {
  engine ??= new AudioEngine();
  return engine;
}
