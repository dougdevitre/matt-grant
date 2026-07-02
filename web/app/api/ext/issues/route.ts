import { extRoute } from "@/lib/http/ext-route";
import { listSubmissionsForModeration } from "@/lib/issue-board/airtable";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read the moderation queue (all submissions) + OPTIONS — moderateIssues
// (admin + captain). The Airtable dashboard-read gate is enforced inside the lib.
export const { GET, OPTIONS } = extRoute({
  capability: "moderateIssues",
  source: "issue submissions",
  load: () => listSubmissionsForModeration(),
});
