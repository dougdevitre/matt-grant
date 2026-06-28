// Report a runtime error to whatever monitoring is available: Sentry if it's on
// the page, otherwise a GA4 `exception` event — so errors are at least visible in
// GA while no dedicated monitor is configured, and the upgrade to Sentry is
// drop-in (add the SDK; this starts using it). No-op without a target; never
// throws (monitoring must never break the app).

type Ctx = Record<string, string | number | boolean>;

type MonitoredWindow = Window & {
  Sentry?: { captureException?: (e: unknown, opts?: { extra?: Ctx }) => void };
  gtag?: (...args: unknown[]) => void;
};

export function reportError(error: unknown, ctx: Ctx = {}): void {
  if (typeof window === "undefined") return;
  const w = window as MonitoredWindow;
  const message = error instanceof Error ? error.message : String(error);
  try {
    if (typeof w.Sentry?.captureException === "function") {
      w.Sentry.captureException(error, { extra: ctx });
      return;
    }
    if (typeof w.gtag === "function") {
      w.gtag("event", "exception", {
        description: `${message} | ${JSON.stringify(ctx)}`.slice(0, 480),
        fatal: ctx.fatal === true,
      });
    }
  } catch {
    // swallow — reporting must never surface a new error
  }
}
