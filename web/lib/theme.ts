// Shared design tokens — owned by Lane 1 (Foundation). Single source of truth.
//
// These mirror the Tailwind palette in `tailwind.config.ts`. Use this module in
// non-Tailwind contexts that need the brand colors as literals — OG/Twitter image
// generation (`lib/og.tsx`), email HTML (`lib/email/layout.ts`), and any inline
// SVG/canvas rendering. Tailwind classes remain the way to style components; this
// is for the places a className can't reach. Keep the two in sync.
//
// Palette: "Ledger & Banner" civic identity — red / white / blue only.

export const colors = {
  ink: "#0F2540", // primary authority navy
  field: "#16365C", // deep field blue
  gold: "#2563EB", // campaign accent BLUE (token name kept for compatibility)
  goldlight: "#6BA6FF", // lighter accent for ON-dark use (~5.8:1 on ink); fails on white
  brick: "#B5343B", // red — urgency / primary CTA
  paper: "#FBFAF6", // warm white
  slate: "#5A6472", // muted body / captions
  line: "#E4E2DA", // hairline borders
} as const;

export type ColorToken = keyof typeof colors;

export const fonts = {
  display: 'var(--font-display), Georgia, serif',
  sans: 'var(--font-sans), system-ui, sans-serif',
  mono: 'var(--font-mono), ui-monospace, monospace',
} as const;

// Accessible pairings, pre-checked so lanes don't have to re-derive contrast:
//   • text ON ink/field (dark): use paper, goldlight (NOT gold — 2.98:1 fails AA)
//   • text ON paper (light):    use ink, field, brick, slate (NOT goldlight)
export const onDark = { text: colors.paper, accent: colors.goldlight } as const;
export const onLight = { text: colors.ink, accent: colors.brick } as const;
