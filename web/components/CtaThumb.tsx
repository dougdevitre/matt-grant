import type { CtaThumb as CtaThumbData } from "@/lib/cta-manifest.generated";

// Renders a pre-generated CTA thumbnail as AVIF (+ WebP fallback) at a fixed
// display size. Decorative (alt="" + aria-hidden) — the adjacent link label
// carries the meaning. Fixed width/height = no layout shift.
export function CtaThumb({
  thumb,
  size = 24,
  className = "",
}: {
  thumb: CtaThumbData;
  size?: number;
  className?: string;
}) {
  return (
    <picture>
      <source srcSet={thumb.avif} type="image/avif" />
      {/* eslint-disable-next-line @next/next/no-img-element -- pre-optimized fixed-size <picture>, not next/image */}
      <img
        src={thumb.webp}
        alt=""
        aria-hidden="true"
        width={thumb.w}
        height={thumb.h}
        loading="lazy"
        decoding="async"
        className={`shrink-0 rounded-sm object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    </picture>
  );
}
