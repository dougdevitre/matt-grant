import { getConnection, saveConnection, listConnections, type SocialConnection } from "@/lib/social/connections";
import { getProvider } from "@/lib/social/oauth";

// Token freshness. Refresh-on-read: when a connection is within REFRESH_SKEW of its
// expiry, ask its provider to refresh and persist the (possibly rotated) token
// before it's used. Never throws — on failure it returns the stale connection and
// the UI surfaces the looming expiry so an admin can reconnect.
const REFRESH_SKEW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function needsRefresh(conn: SocialConnection): boolean {
  if (!conn.expiresAt) return false; // long-lived / no expiry
  return new Date(conn.expiresAt).getTime() - Date.now() < REFRESH_SKEW_MS;
}

/** Return a fresh connection, refreshing + persisting if it's near expiry. */
export async function ensureFresh(conn: SocialConnection): Promise<SocialConnection> {
  if (!needsRefresh(conn)) return conn;
  const provider = getProvider(conn.platform);
  if (!provider?.refresh) return conn;
  try {
    const updated = await provider.refresh(conn);
    if (updated) {
      await saveConnection(updated);
      return updated;
    }
  } catch {
    /* keep the stale token; expiry is surfaced in the UI */
  }
  return conn;
}

/** Convenience: load + freshen a platform's connection in one call. */
export async function getFreshConnection(platform: string): Promise<SocialConnection | null> {
  const conn = await getConnection(platform);
  return conn ? ensureFresh(conn) : null;
}

/** Cron backstop: refresh every connection nearing expiry, so tokens stay valid
 *  even without traffic. Returns how many were refreshed. */
export async function refreshExpiring(): Promise<{ checked: number; refreshed: number }> {
  const conns = await listConnections();
  let refreshed = 0;
  for (const c of conns) {
    if (!needsRefresh(c)) continue;
    const before = c.expiresAt;
    const fresh = await ensureFresh(c);
    if (fresh.expiresAt !== before) refreshed++;
  }
  return { checked: conns.length, refreshed };
}
