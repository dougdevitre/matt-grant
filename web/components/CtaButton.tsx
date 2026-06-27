"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ctaThumb } from "@/lib/cta-images";
import { track } from "@/lib/analytics";

// A strong call-to-action button with an optional context-aware thumbnail.
//
// The image is a pre-generated AVIF (+ WebP fallback) square served same-origin
// from /cta/ — a few KB, fixed width/height (no layout shift), and decorative
// (alt="" + aria-hidden) because the button label carries the meaning. When the
// context has no mapped image it renders as a plain text button — same styling,
// no gap artifact (the thumbnail simply isn't emitted).
//
// Use `external` for off-site CTAs (e.g. the WinRed donate URL) so it renders an
// <a target="_blank">; internal CTAs render a client-side <Link>.

type CtaButtonProps = {
  href: string;
  children: ReactNode;
  /** Selects the contextual thumbnail (see lib/cta-images.ts). */
  context?: string;
  /** Render an off-site <a target="_blank"> instead of next/link. */
  external?: boolean;
  className?: string;
  onClick?: () => void;
  /** Rendered thumbnail size in px (intrinsic source is 144px → crisp at any of these). */
  thumbSize?: number;
};

export function CtaButton({
  href,
  children,
  context,
  external = false,
  className = "btn-primary",
  onClick,
  thumbSize = 28,
}: CtaButtonProps) {
  const thumb = ctaThumb(context);

  const handleClick = () => {
    track("cta_click", {
      label: typeof children === "string" ? children : (context ?? "cta"),
      context: context ?? "",
      external,
    });
    onClick?.();
  };

  const inner = (
    <>
      {thumb && (
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
            className="-ml-1 shrink-0 rounded-full object-cover ring-1 ring-paper/40"
            style={{ width: thumbSize, height: thumbSize }}
          />
        </picture>
      )}
      <span>{children}</span>
    </>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className} onClick={handleClick}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={className} onClick={handleClick}>
      {inner}
    </Link>
  );
}
