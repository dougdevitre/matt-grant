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

// Sequential turnout ramp, low → high (tan → gold → orange → red). This is the
// EXISTING campaign map styling, centralized here unchanged.
//
// NOTE (dataviz validator): this ramp fails two sequential checks — the light end
// (#d8d5cc, 1.43:1 vs surface) is too faint, and it spans ~69° of hue (a multi-hue
// ramp reads as rainbow, not magnitude; the rule is one hue light→dark). A
// validated single-hue replacement, if we choose to restyle the map, is the brand
// blue ramp below (kept commented so the swap is a one-line change + a design sign-off):
//   export const TURNOUT_RAMP = ["#cde2fb", "#6da7ec", "#2a78d6", "#0d366b"] as const;
export const TURNOUT_RAMP = ["#d8d5cc", "#E0A53B", "#cf7a39", "#B5343B"] as const;

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
