import { NextResponse } from "next/server";
import { walgreens, walgreensEnabled, wgPost } from "@/lib/walgreens";

export const runtime = "nodejs";

// Submit the order. The client must collect explicit T&C consent before calling
// this (Walgreens requires it); we double-check the flag server-side too.
export async function POST(req: Request) {
  if (!walgreensEnabled) {
    return NextResponse.json({ error: "Printing is not configured yet." }, { status: 503 });
  }
  const body = await req.json().catch(() => ({}));
  const { firstName, lastName, phone, email, storeNum, promiseTime, productDetails, couponCode, affNotes, agreedToTerms } = body ?? {};

  if (!agreedToTerms) {
    return NextResponse.json({ error: "Terms of Use must be accepted." }, { status: 400 });
  }
  for (const [k, v] of Object.entries({ firstName, lastName, phone, email, storeNum, promiseTime })) {
    if (!v) return NextResponse.json({ error: `${k} is required` }, { status: 400 });
  }
  if (!Array.isArray(productDetails) || !productDetails.length) {
    return NextResponse.json({ error: "productDetails is required" }, { status: 400 });
  }

  const r = await wgPost("/api/photo/order/submit/v3", {
    act: "submitphotoorder",
    firstName, lastName, phone, email,
    storeNum, promiseTime,
    productDetails,
    ...(couponCode ? { couponCode } : {}),
    ...(walgreens.publisherId ? { publisherId: walgreens.publisherId } : {}),
    affNotes: affNotes ?? `mg-${Date.now()}`,
  });
  return NextResponse.json(r.json as object, { status: r.ok ? 200 : 502 });
}
