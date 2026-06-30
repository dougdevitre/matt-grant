import Link from "next/link";
import { SITE_URL } from "@/lib/site";

export type Crumb = { name: string; href?: string };

// Visual breadcrumb trail + BreadcrumbList JSON-LD. The last crumb is the current
// page and carries no href. The structured data uses absolute URLs so Google can
// render the breadcrumb in search results and follow the crawl path back to the hub.
// `variant` styles the trail for light page bodies or the dark hero band.
export function Breadcrumbs({
  items,
  variant = "light",
  className = "",
}: {
  items: Crumb[];
  variant?: "light" | "dark";
  className?: string;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      ...(c.href ? { item: `${SITE_URL}${c.href}` } : {}),
    })),
  };

  const link = variant === "dark" ? "text-goldlight hover:text-paper" : "text-slate hover:text-ink";
  const current = variant === "dark" ? "text-paper" : "text-ink";
  const sep = variant === "dark" ? "text-paper/30" : "text-line";

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ol className="flex flex-wrap items-center gap-1.5 font-mono text-xs uppercase tracking-eyebrow">
        {items.map((c, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {c.href ? (
              <Link href={c.href} className={link}>
                {c.name}
              </Link>
            ) : (
              <span aria-current="page" className={current}>
                {c.name}
              </span>
            )}
            {i < items.length - 1 && (
              <span aria-hidden="true" className={sep}>
                /
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
