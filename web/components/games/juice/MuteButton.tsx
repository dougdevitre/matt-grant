"use client";

import { useSfx } from "@/lib/games/juice/sfx";

// Persistent sound toggle for the games. Reflects the shared mute store, so it
// stays in sync wherever it's mounted. Small, unobtrusive, keyboard-operable.
export function MuteButton({ className = "" }: { className?: string }) {
  const { muted, toggle, play } = useSfx();
  return (
    <button
      type="button"
      onClick={() => {
        toggle();
        if (muted) play("uiClick"); // was muted → now on: confirm with a tick
      }}
      aria-pressed={!muted}
      aria-label={muted ? "Unmute game sound" : "Mute game sound"}
      title={muted ? "Sound off" : "Sound on"}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-ink shadow-card transition hover:border-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${className}`}
    >
      <span aria-hidden="true" className="text-base leading-none">
        {muted ? "🔇" : "🔊"}
      </span>
    </button>
  );
}
