"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/report-error";

// Catches errors thrown in the ROOT layout itself (which app/error.tsx can't —
// it renders inside the layout). Replaces the whole document, so it must render
// its own <html>/<body>. Kept minimal and dependency-free for that reason.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, { kind: "global-error", fatal: true, digest: error.digest ?? "" });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ display: "grid", placeItems: "center", minHeight: "100vh", margin: 0, fontFamily: "Georgia, serif", background: "#FBFAF6", color: "#0F2540", textAlign: "center", padding: "2rem" }}>
        <div>
          <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>We hit a snag.</h1>
          <p style={{ color: "#5A6472", marginBottom: "1.5rem" }}>Please try again.</p>
          <button
            onClick={reset}
            style={{ background: "#B5343B", color: "#FBFAF6", border: 0, borderRadius: 3, padding: "0.75rem 1.5rem", fontWeight: 700, cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
