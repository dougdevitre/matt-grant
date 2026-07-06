import Link from "next/link";
import { requireCap } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { HowTo, PageHeader } from "@/components/dashboard/Notice";
import { ExtensionInstallButton } from "@/components/dashboard/ExtensionInstallButton";
import { ExtensionActivity } from "@/components/dashboard/ExtensionActivity";
import { EXTENSION, extensionConnected, extensionStoreUrl } from "@/lib/extension";

export const dynamic = "force-dynamic";

// Captain-facing adoption page for the campaign Chrome extension. Gated on
// viewOverview — the whole staff tier (captains, volunteers, admins) benefits, and
// the extension adds no capability of its own: it's a browser-side view of the same
// data, enforced by the same RBAC (see lib/extension.ts, web/docs/extension-api.md).
export default async function ExtensionPage() {
  const { role } = await requireCap("viewOverview");
  const connected = extensionConnected();
  const storeUrl = extensionStoreUrl();
  // Only show a captain the features their role can actually use in the extension
  // (the endpoints are capability-gated identically). Volunteers, e.g., see tasks +
  // overview but not events/issues.
  const features = EXTENSION.features.filter((f) => can(role, f.cap));

  return (
    <>
      <PageHeader kicker="Field tools" title={EXTENSION.name} />

      {/* Hero: value prop + the install call-to-action (flips to "Installed" via the
          postMessage handshake once the extension announces itself). */}
      <div className="card p-6">
        <p className="eyebrow text-brick">{EXTENSION.tagline}</p>
        <p className="mt-2 max-w-prose text-sm text-ink">{EXTENSION.valueProp}</p>
        <div className="mt-5">
          <ExtensionInstallButton storeUrl={storeUrl} />
        </div>
      </div>

      {/* What you can do — filtered to the current role's capabilities. */}
      {features.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.key} className="card p-5">
              <p className="text-sm font-semibold text-ink">{f.title}</p>
              <p className="mt-1 text-xs text-slate">{f.blurb}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6">
        <HowTo
          title="Install & sign in — 3 steps"
          steps={[
            "Install it from the Chrome Web Store (button above), then pin it so the icon stays in your toolbar.",
            "Click the extension icon and sign in with the same campaign account you use here — it reuses your existing session, so there's no second password.",
            "You'll see exactly what your role allows: the tools above map to the same permissions as this dashboard.",
          ]}
        />
      </div>

      {/* Admin setup note — the /api/ext/* surface is fail-closed until two env vars
          are set. Only admins can act on it, so only they see it. */}
      {!connected && can(role, "manageTeam") && (
        <div className="mt-6 rounded-sm border border-gold/50 bg-gold/10 px-5 py-4 text-sm text-ink">
          <p className="font-semibold">Extension connection isn&rsquo;t turned on yet.</p>
          <p className="mt-1 text-slate">
            Staff can install it, but it can&rsquo;t reach campaign data until{" "}
            <code className="font-mono text-xs">EXTENSION_ORIGIN</code> and{" "}
            <code className="font-mono text-xs">CLERK_AUTHORIZED_PARTIES</code> are set (plus the one-time
            Clerk allowed-origin step). See the{" "}
            <Link href="/dashboard/setup" className="text-field underline">
              Setup &amp; status
            </Link>{" "}
            page and the extension API doc for details.
          </p>
        </div>
      )}

      {/* Admin-only adoption/usage panel — who has started using the extension,
          so the campaign can measure uptake and nudge the rest. */}
      {can(role, "manageTeam") && <ExtensionActivity />}
    </>
  );
}
