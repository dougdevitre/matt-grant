// Deterministic, fast, seedable PRNG for the game engine. mulberry32 over an
// xfnv1a hash of the string seed: same seed → same stream on every platform
// (client render + server replay validation). This is the ONLY randomness source
// permitted inside a sim (see ./types.ts purity note).

/** FNV-1a hash of a string → 32-bit unsigned int. Spreads a string seed into the PRNG space. */
export function xfnv1a(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

/** mulberry32: tiny, fast 32-bit PRNG → () => float in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build a seeded [0,1) generator from a string seed. */
export const makeRng = (seed: string): (() => number) => mulberry32(xfnv1a(seed));

/** Pick an index from a weighted table using one rng draw. Pure given (rng, weights). */
export function weightedPick(rng: () => number, weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}
