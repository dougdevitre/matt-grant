"use client";

// The install call-to-action on /dashboard/extension. Renders one of three states:
//   • installed  → a "Installed" confirmation (detected via the postMessage handshake)
//   • available  → an "Install from the Chrome Web Store" button (store URL is set)
//   • pending    → a "coming to the Web Store" placeholder (no store URL configured)
// It reads install status live through useExtensionInstalled(), so it flips to the
// installed state the moment the extension announces itself — no reload needed.

import { useExtensionInstalled } from "@/lib/extension-detect";

export function ExtensionInstallButton({ storeUrl }: { storeUrl: string | null }) {
  const status = useExtensionInstalled();

  if (status.state === "installed") {
    return (
      <div className="flex flex-col gap-1">
        <span className="inline-flex w-fit items-center gap-2 rounded-sm border border-field/40 bg-field/10 px-4 py-2 text-sm font-semibold text-field">
          <span aria-hidden>✓</span>
          Installed{status.version ? ` · v${status.version}` : ""}
        </span>
        <span className="text-xs text-slate">
          Open it from the puzzle-piece icon in your browser toolbar (pin it to keep it handy).
        </span>
      </div>
    );
  }

  if (storeUrl) {
    return (
      <div className="flex flex-col gap-1">
        <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="btn-primary w-fit">
          Install from the Chrome Web Store
        </a>
        <span className="text-xs text-slate">Opens the Web Store in a new tab.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="inline-flex w-fit items-center rounded-sm border border-line bg-line/40 px-4 py-2 text-sm font-semibold text-slate">
        Coming to the Chrome Web Store
      </span>
      <span className="text-xs text-slate">
        An admin can set <code className="font-mono text-xs">NEXT_PUBLIC_EXTENSION_STORE_URL</code> to link
        the listing here.
      </span>
    </div>
  );
}
