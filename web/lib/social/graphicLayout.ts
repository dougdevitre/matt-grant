// Pure, deterministic layout math for the campaign image generator
// (app/api/graphics/route.tsx). Kept out of the satori render tree so it can be
// unit-tested: satori can't measure text at render time, so we size and wrap the
// headline HERE — using a per-glyph advance table calibrated to Fraunces 700 — and
// hand the route explicit, pre-wrapped lines it renders without any further reflow.

export const GRAPHIC_FORMATS = {
  ig_square: { w: 1080, h: 1080, label: "Instagram / FB square" },
  ig_story: { w: 1080, h: 1920, label: "Story / Reel / TikTok" },
  x_header: { w: 1500, h: 500, label: "X post image" },
  fb_cover: { w: 1640, h: 624, label: "Facebook cover" },
  yard_sign: { w: 1100, h: 825, label: "Yard sign (24×18)" },
  web_banner: { w: 1200, h: 400, label: "Web banner" },
} as const;

export type GraphicFormatId = keyof typeof GRAPHIC_FORMATS;

// Composition family by aspect ratio — each is laid out differently in the route.
export type Family = "wide" | "portrait" | "square";
export function familyOf(fmt: { w: number; h: number }): Family {
  // Only strongly-landscape formats use the side-by-side (text | photo) layout;
  // near-square ones (e.g. the 4:3 yard sign) stack, so the headline keeps full width.
  if (fmt.w > fmt.h * 1.4) return "wide";
  if (fmt.h > fmt.w * 1.15) return "portrait";
  return "square";
}

// Per-glyph advance as a fraction of the font size, calibrated to Fraunces 700 (a
// wide serif display face — a flat average badly under-measures caps and m/w and
// over-measures i/l/t). Good enough to wrap accurately; a width safety factor plus
// erring wider keeps satori from ever re-flowing a line we already broke.
const NARROW = new Set("iIl.,:;'!|ïí`".split(""));
const THIN = new Set("jftr()[]{}/\\-".split(""));
const WIDE_LC = new Set("mw".split(""));
const WIDE_UC = new Set("MW".split(""));
export function charAdvance(ch: string): number {
  if (ch === " ") return 0.27;
  if (ch === "—") return 1.05;
  if (NARROW.has(ch)) return 0.32;
  if (THIN.has(ch)) return 0.39;
  if (WIDE_LC.has(ch)) return 0.92;
  if (WIDE_UC.has(ch)) return 1.0;
  if (ch >= "A" && ch <= "Z") return 0.75;
  if (ch >= "0" && ch <= "9") return 0.6;
  return 0.57; // default lowercase / other
}
/** Width of `text` in em (font-size-independent). Multiply by fontSize for px. */
export function measureEm(text: string): number {
  let sum = 0;
  for (const ch of text) sum += charAdvance(ch);
  return sum;
}
export function measureText(text: string, fontSize: number): number {
  return measureEm(text) * fontSize;
}

const WIDTH_SAFETY = 0.92;
const LINE_HEIGHT = 1.08;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export type GraphicLayout = {
  w: number;
  h: number;
  family: Family;
  padX: number;
  padY: number;
  avatar: number; // 0 when no photo
  colGap: number;
  eyebrowSize: number;
  subSize: number;
  discSize: number;
  gapV: number;
  discBand: number;
  ruleH: number;
  textBoxW: number;
  headlineBoxH: number;
  headlineMaxFont: number;
  headlineMinFont: number;
};

// Derive all geometry for one format from its pixel box. `photo`/`hasSub` change the
// space left for the headline, so the fit is honest about what's actually on the card.
export function layoutFor(fmt: { w: number; h: number }, opts: { photo: boolean; hasSub: boolean }): GraphicLayout {
  const { w, h } = fmt;
  const minDim = Math.min(w, h);
  const family = familyOf(fmt);
  const wide = family === "wide";

  const padX = Math.round(w * 0.07);
  const padY = Math.round(h * 0.075);
  const availW = w - 2 * padX;
  const availH = h - 2 * padY;

  const eyebrowSize = clamp(Math.round(minDim * 0.023), 15, 38);
  const subSize = clamp(Math.round(minDim * 0.03), 18, 44);
  const discSize = clamp(Math.round(minDim * 0.024), 16, 32);
  const gapV = Math.round(minDim * 0.025);
  const ruleH = Math.max(8, Math.round(h * 0.012));

  // The route gaps the photo and text block by ~1.6× gapV; count that here so the
  // headline box is honest. Reserve the real disclaimer height (text + its bottom
  // padding + a separation gap) so the subhead can never collide with it.
  const contentGap = Math.round(gapV * 1.6);
  const discBand = discSize + Math.round(padY * 0.7) + gapV;

  const avatar = opts.photo
    ? wide
      ? Math.round(h * 0.6)
      : family === "portrait"
        ? Math.round(w * 0.34)
        : Math.round(minDim * 0.34)
    : 0;
  const colGap = Math.round(minDim * 0.055);

  // Width available to the headline. Wide puts the photo beside the text; stacked
  // families give the headline the full content width.
  const textBoxW = wide ? availW - avatar - colGap : availW;

  // Height available to the headline, after the avatar (stacked families), the
  // eyebrow + subhead, their gaps, and the reserved disclaimer band.
  const stackedChrome = (wide ? 0 : avatar + contentGap) + eyebrowSize + gapV + (opts.hasSub ? subSize + gapV : 0);
  const headlineBoxH = availH - discBand - stackedChrome;

  const headlineMaxFont = wide ? Math.round(h * 0.2) : family === "portrait" ? Math.round(w * 0.11) : Math.round(w * 0.1);
  const headlineMinFont = clamp(Math.round(minDim * 0.03), 22, 60);

  return {
    w, h, family, padX, padY, avatar, colGap,
    eyebrowSize, subSize, discSize, gapV, discBand, ruleH,
    textBoxW: Math.max(80, textBoxW),
    headlineBoxH: Math.max(headlineMinFont * LINE_HEIGHT, headlineBoxH),
    headlineMaxFont, headlineMinFont,
  };
}

export type FitResult = { fontSize: number; lineHeight: number; lines: string[] };

// Greedy word-wrap to a max line width in EM (font-size-independent).
function wrapEm(words: string[], maxEm: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    if (!cur) { cur = word; continue; }
    if (measureEm(cur + " " + word) <= maxEm) cur += " " + word;
    else { lines.push(cur); cur = word; }
  }
  if (cur) lines.push(cur);
  return lines;
}

// Re-pack `words` into visually balanced lines (no lonely last word) within the line
// budget — binary-searches the minimal max-line em-width that packs into ≤ maxLines.
export function balanceLines(words: string[], maxLines: number): string[] {
  if (maxLines <= 1 || words.length <= 1) return [words.join(" ")];
  const longestWord = Math.max(...words.map(measureEm));
  const packable = (limitEm: number): number => {
    let lines = 1;
    let cur = 0;
    for (const word of words) {
      const wEm = measureEm(word);
      const next = cur === 0 ? wEm : cur + measureEm(" ") + wEm;
      if (next <= limitEm) cur = next;
      else { lines++; cur = wEm; }
    }
    return lines;
  };
  let lo = longestWord;
  let hi = measureEm(words.join(" "));
  while (hi - lo > 0.01) {
    const mid = (lo + hi) / 2;
    if (packable(mid) <= maxLines) hi = mid;
    else lo = mid + 0.01;
  }
  return wrapEm(words, hi);
}

// Fit `text` into a box: step the font down from maxFont until the measured headline
// fits both width and height, then balance the lines. Falls back to minFont (tightly
// wrapped) if nothing fits — trimHeadline upstream caps length, and the reserved
// disclaimer band means even the fallback can't collide with the "Paid for by" line.
export function fitHeadline(opts: {
  text: string;
  boxW: number;
  boxH: number;
  maxFont: number;
  minFont: number;
  lineHeight?: number;
  maxLines?: number;
}): FitResult {
  const lineHeight = opts.lineHeight ?? LINE_HEIGHT;
  const maxLines = opts.maxLines ?? 5;
  const words = opts.text.split(/\s+/).filter(Boolean);
  const usableW = opts.boxW * WIDTH_SAFETY;
  if (words.length === 0) return { fontSize: opts.minFont, lineHeight, lines: [""] };

  for (let font = opts.maxFont; font >= opts.minFont; font -= 2) {
    const maxEm = usableW / font;
    const lines = wrapEm(words, maxEm);
    if (lines.length > maxLines) continue;
    const longestPx = Math.max(...lines.map((l) => measureText(l, font)));
    const heightPx = lines.length * font * lineHeight;
    if (longestPx <= usableW && heightPx <= opts.boxH) {
      return { fontSize: font, lineHeight, lines: balanceLines(words, lines.length) };
    }
  }

  const maxEm = usableW / opts.minFont;
  const lines = wrapEm(words, maxEm);
  return { fontSize: opts.minFont, lineHeight, lines: balanceLines(words, Math.min(lines.length, maxLines)) };
}
