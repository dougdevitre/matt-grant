"use client";

// Synthesized sound effects for the games — zero asset files. Every sound is a
// short WebAudio oscillator envelope, so there's nothing to download and nothing
// to serve from the CDN. The AudioContext is created lazily on the first play so
// SSR/import is safe, and unlocked by the Start click (browsers block audio until
// a user gesture). Mute is a tiny pub/sub backed by localStorage so the toggle
// and every game stay in sync across mounts.
import { useCallback, useEffect, useState } from "react";

export type SfxName = "jump" | "land" | "collect" | "hit" | "combo" | "powerup" | "gameover" | "uiClick";

const STORAGE_KEY = "mg-games-muted";

let ctx: AudioContext | null = null;
let muted = false;
let loaded = false;
const listeners = new Set<(m: boolean) => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    muted = window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    /* private mode / disabled storage — default unmuted */
  }
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

// Resume the context — call from a user gesture (the Start button) so the first
// in-game sound isn't swallowed by the autoplay policy.
export function unlockAudio() {
  const c = getCtx();
  if (c && c.state === "suspended") void c.resume();
}

export function isMuted(): boolean {
  load();
  return muted;
}

export function setMuted(next: boolean) {
  load();
  muted = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn(next));
}

// One short tone with an attack/decay envelope. Frequency can glide from → to.
function tone(
  c: AudioContext,
  opts: { type: OscillatorType; from: number; to?: number; dur: number; gain?: number; delay?: number },
) {
  const t0 = c.currentTime + (opts.delay ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  const peak = opts.gain ?? 0.14;
  osc.type = opts.type;
  osc.frequency.setValueAtTime(opts.from, t0);
  if (opts.to && opts.to !== opts.from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), t0 + opts.dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + opts.dur + 0.02);
}

// `level` lets combo sounds pitch up as the streak grows.
export function playSfx(name: SfxName, level = 0) {
  load();
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  switch (name) {
    case "jump":
      tone(c, { type: "sine", from: 320, to: 620, dur: 0.13, gain: 0.12 });
      break;
    case "land":
      tone(c, { type: "triangle", from: 180, to: 120, dur: 0.09, gain: 0.1 });
      break;
    case "collect":
      tone(c, { type: "sine", from: 680, to: 990, dur: 0.1, gain: 0.12 });
      tone(c, { type: "sine", from: 990, dur: 0.08, gain: 0.08, delay: 0.06 });
      break;
    case "hit":
      tone(c, { type: "sawtooth", from: 300, to: 90, dur: 0.22, gain: 0.16 });
      break;
    case "combo": {
      const base = 520 + Math.min(8, level) * 90;
      tone(c, { type: "square", from: base, to: base * 1.5, dur: 0.12, gain: 0.09 });
      break;
    }
    case "powerup":
      tone(c, { type: "triangle", from: 440, to: 880, dur: 0.16, gain: 0.12 });
      tone(c, { type: "triangle", from: 660, to: 1320, dur: 0.16, gain: 0.08, delay: 0.06 });
      break;
    case "gameover":
      tone(c, { type: "sawtooth", from: 440, to: 330, dur: 0.16, gain: 0.12 });
      tone(c, { type: "sawtooth", from: 330, to: 220, dur: 0.2, gain: 0.12, delay: 0.14 });
      tone(c, { type: "sawtooth", from: 220, to: 150, dur: 0.28, gain: 0.12, delay: 0.32 });
      break;
    case "uiClick":
      tone(c, { type: "square", from: 520, dur: 0.05, gain: 0.06 });
      break;
  }
}

// React binding: play(), the live muted flag, and a toggle. Subscribes to the
// shared store so every mounted game reflects the same mute state instantly.
export function useSfx() {
  const [m, setM] = useState<boolean>(() => isMuted());
  useEffect(() => {
    const fn = (next: boolean) => setM(next);
    listeners.add(fn);
    setM(isMuted());
    return () => {
      listeners.delete(fn);
    };
  }, []);
  const play = useCallback((name: SfxName, level = 0) => playSfx(name, level), []);
  const toggle = useCallback(() => setMuted(!isMuted()), []);
  return { play, muted: m, toggle, unlock: unlockAudio };
}
