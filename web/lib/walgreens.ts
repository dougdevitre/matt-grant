// Walgreens Native Photo Prints client. Imported ONLY by /api/print/* route
// handlers (server) — the apiKey/affId must never reach the browser. Sandbox by
// default; set WALGREENS_ENV=production after Walgreens approves the app.
import { requestWithRetry } from "@/lib/integrations/http";

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
  // Shared transport for the timeout, but retries:0 — Walgreens order submit is NOT
  // idempotent, so a blind retry could double-submit. (Idempotent product/store/
  // coupon calls could opt into retries later.) Preserve the never-throws WgResult.
  try {
    const res = await requestWithRetry(`${walgreens.base}${path}`, {
      method: "POST",
      body: {
        apiKey: walgreens.apiKey,
        affId: walgreens.affId,
        appVer: walgreens.appVer,
        devInf: walgreens.devInf,
        ...body,
      },
      timeoutMs: 20_000,
      retries: 0,
      label: "walgreens",
    });
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
    return { ok: res.ok, status: res.status, json };
  } catch (err) {
    return { ok: false, status: 0, json: { error: String(err) } };
  }
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
