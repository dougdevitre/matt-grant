import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { walgreens, walgreensEnabled, wgPost } from "@/lib/walgreens";
import { ddb, TABLE, dbConfigured } from "@/lib/db";

export const runtime = "nodejs";

// Dedupe partition for submitted print orders. A stable hash of the order makes a
// retried identical submission idempotent so a flaky network can't place (and
// charge for) the same order twice. TODO: register under lib/db PK with Lane 1.
const PRINT_ORDER_PK = "PRINTORDER";

function orderKey(o: Record<string, unknown>): string {
  const stable = JSON.stringify([o.firstName, o.lastName, o.phone, o.storeNum, o.promiseTime, o.productDetails]);
  return createHash("sha256").update(stable).digest("hex").slice(0, 32);
}

// Submit the order. The client must collect explicit T&C consent before calling
// this (Walgreens requires it); we double-check the flag server-side too.
export async function POST(req: Request) {
  if (!walgreensEnabled) {
    return NextResponse.json({ error: "Printing is not configured yet." }, { status: 503 });
  }
  const body = await req.json().catch(() => ({}));
  const { firstName, lastName, phone, email, storeNum, promiseTime, productDetails, couponCode, agreedToTerms } = body ?? {};

  if (!agreedToTerms) {
    return NextResponse.json({ error: "Terms of Use must be accepted." }, { status: 400 });
  }
  for (const [k, v] of Object.entries({ firstName, lastName, phone, email, storeNum, promiseTime })) {
    if (!v) return NextResponse.json({ error: `${k} is required` }, { status: 400 });
  }
  if (!Array.isArray(productDetails) || !productDetails.length) {
    return NextResponse.json({ error: "productDetails is required" }, { status: 400 });
  }

  const key = orderKey(body);

  // Claim the key before submitting (at-most-once). If the claim already exists,
  // this is a duplicate submission — reject rather than place a second order.
  if (dbConfigured) {
    try {
      await ddb.send(new PutCommand({
        TableName: TABLE,
        Item: { PK: PRINT_ORDER_PK, SK: key, createdAt: new Date().toISOString() },
        ConditionExpression: "attribute_not_exists(PK)",
      }));
    } catch (e) {
      if ((e as { name?: string })?.name === "ConditionalCheckFailedException") {
        return NextResponse.json({ error: "This order was already submitted.", status: "duplicate" }, { status: 409 });
      }
      throw e;
    }
  }

  const r = await wgPost("/api/photo/order/submit/v3", {
    act: "submitphotoorder",
    firstName, lastName, phone, email,
    storeNum, promiseTime,
    productDetails,
    ...(couponCode ? { couponCode } : {}),
    ...(walgreens.publisherId ? { publisherId: walgreens.publisherId } : {}),
    affNotes: `mg-${key}`, // deterministic — same order → same note
  });

  if (!r.ok) {
    // Release the claim so the user can legitimately retry after a real failure,
    // and DON'T reflect the upstream payload (it can echo PII / internal detail).
    if (dbConfigured) {
      await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { PK: PRINT_ORDER_PK, SK: key } })).catch(() => {});
    }
    console.error("[print/order] walgreens", r.status, r.json);
    return NextResponse.json(
      { error: "Order could not be submitted. Please try again or contact the store.", status: "failed" },
      { status: 502 },
    );
  }

  // Whitelist the response — never spread the upstream JSON back to the client.
  const j = (r.json ?? {}) as Record<string, unknown>;
  return NextResponse.json({
    status: "submitted",
    orderId: j.orderId ?? j.orderNumber ?? j.confirmationNumber ?? null,
    promiseTime: j.promiseTime ?? promiseTime ?? null,
  });
}
