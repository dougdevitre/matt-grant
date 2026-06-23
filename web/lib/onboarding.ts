import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, dbConfigured } from "@/lib/db";

// Per-user "I've dismissed the Start-here guide" flag. One partition (ONBOARDING),
// SK = the staffer's email. Best-effort: any failure (or no DB / no email) just
// means the guide keeps showing — we never hide it on an error.

export async function onboardingDismissed(email: string | null): Promise<boolean> {
  if (!dbConfigured || !email) return false;
  try {
    const out = await ddb.send(
      new GetCommand({ TableName: TABLE, Key: { PK: PK.onboarding, SK: email.toLowerCase() } }),
    );
    return !!out.Item?.dismissedAt;
  } catch {
    return false;
  }
}

export async function dismissOnboarding(email: string | null): Promise<void> {
  if (!dbConfigured || !email) return;
  try {
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: { PK: PK.onboarding, SK: email.toLowerCase(), dismissedAt: new Date().toISOString() },
      }),
    );
  } catch {
    /* best-effort — a failed dismiss just shows the guide again next load */
  }
}
