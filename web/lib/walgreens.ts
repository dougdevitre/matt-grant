// Walgreens Native Photo Prints client. Imported ONLY by /api/print/* route
// handlers (server) — the apiKey/affId must never reach the browser. Sandbox by
// default; set WALGREENS_ENV=production after Walgreens approves the app.
const ENV = process.env.WALGREENS_ENV === "production" ? "production" : "sandbox";
const BASE = ENV === "production"
  ? "https://services.walgreens.com"
  : "https://services-qa.walgreens.com";

export const walgreens = {
  apiKey: process.env.WALGREENS_API_KEY ?? "",
  affId: process.env.WALGREENS_AFF_ID ?? "",
  publisherId: process.env.WALGREENS_PUBLISHER_ID ?? "",
  env: ENV,
  base: BASE,
  appVer: "1.0",
  devInf: "web,1.0",
};

// If creds are absent the routes still respond (configured:false) so the UI can
// show a setup notice instead of failing — same pattern as Clerk/Congress here.
export const walgreensEnabled = Boolean(walgreens.apiKey && walgreens.affId);

export type WgResult = { ok: boolean; status: number; json: unknown };

export async function wgPost(path: string, body: Record<string, unknown>): Promise<WgResult> {
  const res = await fetch(`${walgreens.base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      apiKey: walgreens.apiKey,
      affId: walgreens.affId,
      appVer: walgreens.appVer,
      devInf: walgreens.devInf,
      ...body,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  let json: unknown;
  const text = await res.text();
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json };
}

export type WgProduct = {
  productId: string;
  productSize: string;
  productGroupId: string;
  productDesc: string;
  productPrice: string;
  dpi?: string;
  offsetWidth?: string;
  offsetHeight?: string;
};
