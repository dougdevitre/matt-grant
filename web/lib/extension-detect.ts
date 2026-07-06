"use client";

// Web half of the extension install handshake. The web app can't otherwise tell
// whether the Chrome extension is installed — session sharing only flows
// extension → web (Clerk syncHost, see web/docs/extension-api.md). So we rely on a
// tiny content-script announce that the `matt-grant-chrome` repo implements: on the
// app origin it posts `{ source: "mg-extension", installed: true, version }` via
// window.postMessage. This hook listens for it (and proactively pings, so the page
// still learns about an extension that loaded before the listener mounted).
//
// Contract documented in web/docs/extension-api.md → "Install detection". Until the
// extension ships its half, this stays in the `unknown` state and the UI shows the
// normal Install call-to-action — it never blocks or misleads.

import { useEffect, useState } from "react";

export const EXT_MESSAGE_SOURCE = "mg-extension";
export const EXT_PROBE_SOURCE = "mg-extension-probe";

// Shape the content script must post. `installed` is always true on an announce;
// `version` is the extension's manifest version (optional, for display/debugging).
export type ExtensionAnnounce = {
  source: typeof EXT_MESSAGE_SOURCE;
  installed: true;
  version?: string;
};

export type ExtensionStatus =
  | { state: "unknown" }
  | { state: "installed"; version: string | null };

function isAnnounce(data: unknown): data is ExtensionAnnounce {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { source?: unknown }).source === EXT_MESSAGE_SOURCE &&
    (data as { installed?: unknown }).installed === true
  );
}

/**
 * Returns the live install status. Starts `unknown`; flips to `installed` (with the
 * reported version, if any) the first time a valid announce arrives from this same
 * origin. Best-effort and read-only — safe to render an Install CTA off `unknown`.
 */
export function useExtensionInstalled(): ExtensionStatus {
  const [status, setStatus] = useState<ExtensionStatus>({ state: "unknown" });

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // Only trust same-origin messages: a content script posts with the page's
      // own origin, so anything cross-origin is not our extension.
      if (event.origin !== window.location.origin) return;
      if (!isAnnounce(event.data)) return;
      const version = typeof event.data.version === "string" ? event.data.version : null;
      setStatus((prev) => (prev.state === "installed" ? prev : { state: "installed", version }));
    }
    window.addEventListener("message", onMessage);
    // Nudge an already-loaded extension to re-announce (it may have posted before
    // this component mounted). The content script listens for this probe and replies
    // with the announce above.
    window.postMessage({ source: EXT_PROBE_SOURCE, type: "ping" }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return status;
}
