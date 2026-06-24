import { PutCommand, QueryCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, dbConfigured } from "@/lib/db";

// Asset-library metadata, stored one record per S3 object (PK="ASSET", SK=<key>).
// S3 stays the source of truth for a file's existence/size/date; this adds the
// things S3 listing can't give us cheaply: staff tags, who uploaded it, the kind,
// and the pre-compression size. listAssets() in lib/s3.ts left-joins this by key,
// so an asset with no record still shows up (just untagged). All calls no-op when
// the table isn't configured, so keyless builds stay green.

export type AssetKind = "image" | "pdf" | "other";

export type AssetMeta = {
  key: string;
  name: string;
  contentType: string;
  kind: AssetKind;
  visibility: "public" | "private";
  size: number;
  originalSize?: number;
  uploadedAt: string;
  uploadedBy?: string;
  tags: string[];
};

// Pure classifier shared by the upload route and the listing join. No S3/DB deps.
export function classifyKind(name: string, contentType?: string): AssetKind {
  const ct = (contentType ?? "").toLowerCase();
  if (ct.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|heic|tiff?)$/i.test(name)) return "image";
  if (ct === "application/pdf" || /\.pdf$/i.test(name)) return "pdf";
  return "other";
}

const cleanTags = (tags: unknown): string[] =>
  Array.isArray(tags)
    ? [...new Set(tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean))].slice(0, 24)
    : [];

export async function putAssetMeta(meta: AssetMeta): Promise<void> {
  if (!dbConfigured) return;
  await ddb.send(
    new PutCommand({ TableName: TABLE, Item: { PK: PK.assets, SK: meta.key, ...meta, tags: cleanTags(meta.tags) } }),
  );
}

export async function listAssetMeta(): Promise<Map<string, AssetMeta>> {
  const out = new Map<string, AssetMeta>();
  if (!dbConfigured) return out;
  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "PK = :p",
      ExpressionAttributeValues: { ":p": PK.assets },
    }),
  );
  for (const it of res.Items ?? []) {
    const m = it as AssetMeta;
    if (m.key) out.set(m.key, { ...m, tags: cleanTags(m.tags) });
  }
  return out;
}

// Set the tag list for an asset. Upserts so a legacy asset (uploaded before the
// metadata store existed) gets a record from the fields the caller can supply.
export async function setAssetTags(
  key: string,
  tags: string[],
  fallback?: Partial<Omit<AssetMeta, "key" | "tags">>,
): Promise<string[]> {
  if (!dbConfigured) return cleanTags(tags);
  const clean = cleanTags(tags);
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: PK.assets, SK: key },
      UpdateExpression:
        "SET #t = :t, #k = :k, #n = if_not_exists(#n, :n), kind = if_not_exists(kind, :kind), visibility = if_not_exists(visibility, :vis), contentType = if_not_exists(contentType, :ct), #sz = if_not_exists(#sz, :sz), uploadedAt = if_not_exists(uploadedAt, :ua)",
      ExpressionAttributeNames: { "#t": "tags", "#k": "key", "#n": "name", "#sz": "size" },
      ExpressionAttributeValues: {
        ":t": clean,
        ":k": key,
        ":n": fallback?.name ?? key.split("/").pop() ?? key,
        ":kind": fallback?.kind ?? classifyKind(key, fallback?.contentType),
        ":vis": fallback?.visibility ?? (key.startsWith("private/") ? "private" : "public"),
        ":ct": fallback?.contentType ?? "application/octet-stream",
        ":sz": fallback?.size ?? 0,
        ":ua": fallback?.uploadedAt ?? new Date().toISOString(),
      },
    }),
  );
  return clean;
}

export async function deleteAssetMeta(key: string): Promise<void> {
  if (!dbConfigured) return;
  await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { PK: PK.assets, SK: key } }));
}
