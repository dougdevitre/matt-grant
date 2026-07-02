# Extension client example (`matt-grant-chrome`)

A copy-paste starting point for the Chrome extension that consumes [`/api/ext/*`](./extension-api.md).
It uses Clerk's `@clerk/chrome-extension` SDK for auth and a small typed wrapper for the API.
Adapt names to your extension's structure (React popup / side panel vs. background worker).

> These are **reference snippets for the separate `matt-grant-chrome` repo**, not code built by
> this app — that's why they live in a Markdown file (extension-only imports like
> `@clerk/chrome-extension` and `import.meta.env` aren't dependencies of this repo). Pin the
> `@clerk/chrome-extension` version you install and check its current API.

## 1. `manifest.json` — permissions Clerk + the API need

```jsonc
{
  "manifest_version": 3,
  "name": "Matt Grant Campaign",
  "version": "1.0.0",
  "permissions": ["storage", "cookies"],
  "host_permissions": [
    "https://mattgrantforcongress.org/*",
    "https://ezvnqn5e5i.us-east-1.awsapprunner.com/*",
    "https://clerk.mattgrantforcongress.org/*"   // Clerk Frontend API — required for session sync
  ],
  "background": { "service_worker": "background.js", "type": "module" },
  "action": { "default_popup": "popup.html" }
  // For a STABLE extension id (so the origin never changes), add the "key" field here — the id
  // must stay constant because it's baked into the server's EXTENSION_ORIGIN /
  // CLERK_AUTHORIZED_PARTIES (see extension-api.md → "Turning it on").
}
```

## 2. Shared config + API client — `src/api.ts`

```ts
// The app origin the server serves from (must be in CLERK_AUTHORIZED_PARTIES).
export const API_BASE = "https://mattgrantforcongress.org";
export const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY; // same key as the web app

// The app's Resource<T> envelope.
type Resource<T> =
  | { ok: true; data: T; meta: unknown }
  | { ok: false; data: null; meta: unknown; error: string };

export class ExtApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Call any /api/ext/* endpoint with a Clerk session token. Throws ExtApiError on !ok. */
export async function extFetch<T>(
  path: string,
  token: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  // 401 = not signed in / origin not authorized; 403 = signed in but lacks the capability.
  const envelope = (await res.json().catch(() => null)) as Resource<T> | null;
  if (!res.ok || !envelope?.ok) {
    throw new ExtApiError(res.status, envelope?.error ?? res.statusText);
  }
  return envelope.data;
}

// Typed helpers for the surface (see extension-api.md for the full list).
export const api = {
  overview: (t: string) => extFetch("/api/ext/overview", t),
  finance:  (t: string) => extFetch("/api/ext/finance", t),
  tasks:    (t: string) => extFetch("/api/ext/tasks", t),
  events:   (t: string) => extFetch("/api/ext/events", t),
  createTask: (t: string, body: { title: string; detail?: string; priority?: string; dueDate?: string }) =>
    extFetch<{ id: string }>("/api/ext/tasks", t, { method: "POST", body }),
  setTaskStatus: (t: string, id: string, status: "TODO" | "DOING" | "DONE") =>
    extFetch("/api/ext/tasks", t, { method: "PATCH", body: { id, status } }),
  proposeExpense: (t: string, body: { vendor?: string; title?: string; amount?: number; purpose?: string }) =>
    extFetch<{ expense: unknown }>("/api/ext/budget/expenses", t, { method: "POST", body }),
  moderateIssue: (t: string, id: string, status: "Approved" | "Rejected") =>
    extFetch("/api/ext/issues/" + id, t, { method: "PATCH", body: { status } }),
};
```

## 3a. Popup / side panel (React) — token from a hook

```tsx
// index.tsx
import { ClerkProvider, SignedIn, SignedOut, SignInButton, useAuth } from "@clerk/chrome-extension";
import { API_BASE, PUBLISHABLE_KEY, api } from "./api";

function Dashboard() {
  const { getToken } = useAuth();
  async function loadOverview() {
    const token = await getToken();          // Clerk session token
    if (!token) return;
    const data = await api.overview(token);   // hits /api/ext/overview with Bearer
    console.log(data);
  }
  return <button onClick={loadOverview}>Load campaign overview</button>;
}

export default function App() {
  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      syncHost={API_BASE}   // shares the signed-in web session from the app origin
    >
      <SignedIn><Dashboard /></SignedIn>
      <SignedOut><SignInButton /></SignedOut>
    </ClerkProvider>
  );
}
```

## 3b. Background service worker — token without React

```ts
// background.ts
import { createClerkClient } from "@clerk/chrome-extension/background";
import { API_BASE, PUBLISHABLE_KEY, api } from "./api";

async function getToken(): Promise<string | null> {
  const clerk = await createClerkClient({ publishableKey: PUBLISHABLE_KEY, syncHost: API_BASE });
  return (await clerk.session?.getToken()) ?? null;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    const token = await getToken();
    if (!token) return sendResponse({ error: "not signed in" });
    try {
      if (msg.type === "overview") sendResponse({ data: await api.overview(token) });
      // ...route other message types to api.* helpers
    } catch (e) {
      sendResponse({ error: (e as Error).message });
    }
  })();
  return true; // async response
});
```

## Notes

- **Same Clerk instance:** `PUBLISHABLE_KEY` must be the *same* key as the web app, and `syncHost`
  = your app origin — that's how the extension reuses the signed-in session instead of a second login.
- **Error mapping:** `401` → not signed in / origin not in `CLERK_AUTHORIZED_PARTIES`; `403` → signed
  in but the role lacks that capability; `4xx` bodies carry `{ ok:false, error }`.
- **No cookies needed:** you're using Bearer tokens, so don't set `credentials: "include"`.
- **Server config** (the two env vars + the Clerk allowed-origin step) is in
  [extension-api.md → "Turning it on"](./extension-api.md#turning-it-on-deployment). The surface is
  fail-closed until those are set.
