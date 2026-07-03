// Single source of truth for data-visualization color, keyed to the brand tokens
// in tailwind.config.ts. Before this, the turnout ramp was hand-typed in four
// places (RegionMap3D ×3 + the MapExplorer legend) with off-brand intermediates —
// so a color change meant editing four spots and they drifted. Reference these
// constants instead; the hex lives here once.
//
// (This is the seed of the fuller viz system in the dataviz plan — sequential,
// diverging, categorical, and status roles, all brand-derived.)

// Brand tokens (mirror tailwind.config.ts). Note "accent" is the token named
// "gold" in tailwind, which is actually blue after the red/white/blue rebrand.
export const BRAND = {
  ink: "#0F2540",
  field: "#16365C",
  accent: "#2563EB",
  accentLight: "#6BA6FF",
  brick: "#B5343B",
  paper: "#FBFAF6",
  slate: "#5A6472",
  line: "#E4E2DA",
} as const;

// Sequential turnout ramp, low → high. Single-hue blue, validated with the dataviz
// checker (ordinal mode, light surface): monotone lightness, hue spread 4°, light
// end 2.06:1 vs surface — all checks pass. This replaced the former multi-hue
// tan→gold→orange→red ramp, which failed single-hue + light-end contrast and, being
// red, collided with `brick` (CTA/urgency). Steps are dataviz blue 250/350/450/700.
export const TURNOUT_RAMP = ["#86b6ef", "#5598e7", "#2a78d6", "#0d366b"] as const;

// The legend gradient mirrors the ramp; the % stops track the map's ~8–40 range.
export const TURNOUT_LEGEND_GRADIENT =
  `linear-gradient(to right, ${TURNOUT_RAMP[0]}, ${TURNOUT_RAMP[1]} 31%, ${TURNOUT_RAMP[2]} 62%, ${TURNOUT_RAMP[3]})`;

// Flat fallbacks for boundary-only layers (no turnout feed).
export const MAP_FALLBACK = { jefferson: "#5b7d6f", extra: "#7c6f8e" } as const;

// Map POI categories (categorical) — brand-derived + one amber for "public".
export const MAP_CATEGORY = {
  schools: BRAND.field, // #16365C
  partners: BRAND.brick, // #B5343B
  public: "#E0A53B", // amber (also the mid turnout-ramp stop)
  polling: BRAND.ink, // #0F2540
} as const;

// Published campaign-event marker (field green). Off the core brand set on purpose
// so events read distinct from POIs; centralized here so it's not a stray hex.
export const EVENT_COLOR = "#2f7d4f";

// Draft campaign-event marker (amber), read as lighter than the published green.
export const EVENT_DRAFT = "#E0A53B";

// Dark-gold "ink" for gold-on-light text — the plain gold token fails text
// contrast. NOTE: #9a6f1a is also hand-typed across ~20 dashboard files; a future
// `gold-ink` Tailwind token should absorb those (backlog Tier 2).
export const GOLD_INK = "#9a6f1a";

// Diverging pair for change-around-zero (demographic charts, a future county
// under-15-change choropleth): decline (brick) ↔ growth (accent blue), neutral
// gray at the zero midpoint.
export const DIVERGING = { negative: BRAND.brick, neutral: "#e8e6df", positive: BRAND.accent } as const;

// Status roles — reserved; always pair with an icon/label, never color alone.
export const STATUS = { good: BRAND.field, warn: "#E0A53B", bad: BRAND.brick } as const;
