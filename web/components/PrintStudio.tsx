"use client";

import { useEffect, useMemo, useState } from "react";
import renditions from "@/lib/printRenditions.json";
import { CAMPAIGN } from "@/lib/site";

type Design = { id: string; label: string; thumb: string; sizes: Record<string, string> };
type Product = { productId: string; productSize: string; productDesc: string; productPrice: string };

const DESIGNS = renditions.designs as Design[];
const RSIZES = new Set(renditions.sizes as string[]); // sizes we render purpose-built art for

const promiseLabel = (t?: string) =>
  t && t.startsWith("01-01-3000") ? "Within 48 hours" : t || "";
const largest = (d: Design) => Object.values(d.sizes).at(-1) ?? d.thumb;

export function PrintStudio() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [design, setDesign] = useState<Design | null>(null);
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(1);
  const [contact, setContact] = useState({ firstName: "", lastName: "", phone: "", email: "" });
  const [stores, setStores] = useState<{ photoStoreDetails: Record<string, string> }[]>([]);
  const [store, setStore] = useState<Record<string, string> | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ vendorOrderId?: string; status?: string; err?: string } | null>(null);

  useEffect(() => {
    fetch("/api/print/products", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
      .then((r) => r.json())
      .then((d) => {
        setConfigured(Boolean(d.configured));
        setProducts(Array.isArray(d.products) ? d.products : []);
      })
      .catch(() => setConfigured(false));
  }, []);

  // Only offer products whose size we render purpose-built art for.
  const printable = useMemo(() => products.filter((p) => RSIZES.has(p.productSize)), [products]);
  const product = useMemo(() => printable.find((p) => p.productId === productId), [printable, productId]);
  // The exact-aspect image for the chosen size (fallback to the largest rendition).
  const imageUrl = design ? (product ? design.sizes[product.productSize] ?? largest(design) : largest(design)) : "";
  const cartDetails = product ? [{ productId, qty: String(qty) }] : [];
  // Ordering is live only when configured AND the catalog returned printable
  // sizes. An invalid affiliate / empty catalog falls back to the download flow.
  const ordering = configured === true && printable.length > 0;

  async function findStores() {
    if (!navigator.geolocation || !product) return;
    setBusy("stores");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const res = await fetch("/api/print/stores", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, productDetails: cartDetails }),
        }).then((r) => r.json());
        setStores(res.photoStores ?? []);
        setBusy(null);
      },
      () => setBusy(null),
    );
  }

  async function submit() {
    if (!design || !product || !store) return;
    setBusy("order");
    const res = await fetch("/api/print/order", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...contact,
        storeNum: store.storeNum,
        promiseTime: store.promiseTime,
        agreedToTerms: agreed,
        affNotes: `mg-${design.id}-${product.productSize}`,
        productDetails: [{ productId, imageDetails: [{ url: imageUrl, qty: String(qty) }] }],
      }),
    }).then((r) => r.json());
    setResult(res?.vendorOrderId ? { vendorOrderId: res.vendorOrderId, status: res.status } : { err: res?.error || res?.errDesc || "Order failed." });
    setBusy(null);
  }

  const contactComplete = contact.firstName && contact.lastName && contact.phone && contact.email;
  const canOrder = ordering && design && product && store && contactComplete && agreed;

  if (result?.vendorOrderId) {
    return (
      <div className="card mt-8 p-8">
        <p className="eyebrow text-brick">Order placed</p>
        <h2 className="mt-2 font-display text-2xl font-semibold">Headed to the lab. 🎉</h2>
        <p className="mt-2 text-slate">
          Order <span className="font-mono text-ink">{result.vendorOrderId}</span> — pickup{" "}
          {promiseLabel(store?.promiseTime)} at {store?.storeName || `store #${store?.storeNum}`}.
        </p>
        <p className="mt-1 text-sm text-slate">You&apos;ll get a Walgreens email when it&apos;s ready.</p>
        <button onClick={() => { setResult(null); setDesign(null); setStore(null); }} className="btn-ghost mt-5 px-3 py-1.5 text-sm">
          Print another
        </button>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-8">
      {configured !== null && !ordering && (
        <div className="card border-dashed p-5">
          <p className="eyebrow text-slate">Online ordering — coming soon</p>
          <p className="mt-2 max-w-prose text-sm text-slate">
            Direct-to-Walgreens ordering is being set up. In the meantime, pick a design and download
            the print-ready file (8×10) to print at any Walgreens, Staples, or local shop.
          </p>
        </div>
      )}

      {/* 1 — design */}
      <div>
        <p className="font-display text-lg font-semibold">1. Pick a design</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {DESIGNS.map((d) => (
            <button
              key={d.id}
              onClick={() => setDesign(d)}
              className={`overflow-hidden rounded-sm border-2 text-left transition-colors ${design?.id === d.id ? "border-brick" : "border-line hover:border-ink"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={d.thumb} alt={d.label} className="aspect-square w-full bg-paper object-cover" loading="lazy" />
              <span className="block truncate px-2 py-1 text-[0.65rem] text-slate">{d.label}</span>
            </button>
          ))}
        </div>
        {design && !ordering && (
          <a href={largest(design)} download target="_blank" rel="noopener noreferrer" className="btn-gold mt-4 inline-block">
            Download &ldquo;{design.label}&rdquo; (8×10)
          </a>
        )}
      </div>

      {/* 2 — size */}
      {ordering && (
        <div>
          <p className="font-display text-lg font-semibold">2. Size &amp; quantity</p>
          <div className="mt-3 flex flex-wrap items-end gap-4">
            <label className="block">
              <span className="text-xs font-semibold text-ink">Size</span>
              <select value={productId} onChange={(e) => setProductId(e.target.value)} className="mt-1 block rounded-sm border border-line bg-white px-3 py-2 text-sm">
                <option value="">Choose a size…</option>
                {printable.map((p) => (
                  <option key={p.productId} value={p.productId}>
                    {p.productSize} — ${p.productPrice}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-ink">Qty</span>
              <input type="number" min={1} max={20} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(20, Number(e.target.value))))} className="mt-1 block w-20 rounded-sm border border-line bg-white px-3 py-2 text-sm" />
            </label>
            {design && product && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={imageUrl} alt={`${design.label} ${product.productSize}`} className="h-24 w-auto rounded-sm border border-line" />
            )}
          </div>
        </div>
      )}

      {/* 3 — your info */}
      {ordering && (
        <div>
          <p className="font-display text-lg font-semibold">3. Your details</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {([["firstName", "First name"], ["lastName", "Last name"], ["phone", "Phone"], ["email", "Email"]] as const).map(([k, label]) => (
              <input
                key={k}
                value={contact[k]}
                onChange={(e) => setContact((c) => ({ ...c, [k]: e.target.value }))}
                placeholder={label}
                className="rounded-sm border border-line bg-white px-3 py-2 text-sm"
              />
            ))}
          </div>
        </div>
      )}

      {/* 4 — store */}
      {ordering && (
        <div>
          <p className="font-display text-lg font-semibold">4. Pick a store</p>
          <button onClick={findStores} disabled={!product || busy === "stores"} className="btn-ink mt-3 disabled:opacity-50">
            {busy === "stores" ? "Locating…" : "Find Walgreens near me"}
          </button>
          {stores.length > 0 && (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {stores.map(({ photoStoreDetails: s }) => (
                <li key={s.storeNum}>
                  <button
                    onClick={() => setStore(s)}
                    className={`w-full rounded-sm border-2 p-3 text-left text-sm transition-colors ${store?.storeNum === s.storeNum ? "border-brick" : "border-line hover:border-ink"}`}
                  >
                    <span className="font-semibold text-ink">{s.street}</span>
                    <span className="block text-slate">{s.city}, {s.state} · {s.distance} {s.distanceUnit}</span>
                    <span className="block text-xs text-field">Ready: {promiseLabel(s.promiseTime)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 5 — consent + submit */}
      {ordering && (
        <div className="border-t border-line pt-6">
          <label className="flex items-start gap-2 text-sm text-ink">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 accent-brick" />
            <span>
              I acknowledge that I have read, understand and agree to be bound by the{" "}
              <a href="https://www.walgreens.com/topic/help/generalhelp/termsofuse.jsp" target="_blank" rel="noopener noreferrer" className="underline">Terms of Use</a> and{" "}
              <a href="https://www.walgreens.com/topic/help/generalhelp/privacyandsecurity.jsp" target="_blank" rel="noopener noreferrer" className="underline">Online Privacy &amp; Security Policy</a>.
            </span>
          </label>
          {result?.err && <p className="mt-3 text-sm text-brick">{result.err}</p>}
          <button onClick={submit} disabled={!canOrder || busy === "order"} className="btn-primary mt-4 disabled:opacity-50">
            {busy === "order" ? "Placing order…" : "Place order"}
          </button>
          <p className="mt-3 text-xs text-slate">{CAMPAIGN.paidForBy}</p>
        </div>
      )}
    </div>
  );
}
