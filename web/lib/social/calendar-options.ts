// Client-safe option lists for the social content-calendar editor. Own module (no server-only
// imports) so the client <ContentCalendar> can use these without pulling the server-only Airtable
// client into the browser bundle. Mirrors the singleSelect choices in the Social Media base's
// "Posts" schema — keep in sync if they change there.

export const POST_STATUS = ["Idea", "Draft", "Approved", "Scheduled", "Published"] as const;

export const POST_FORMAT = [
  "Text", "Image", "Link", "Short video", "Long video", "Thread", "Poll", "Carousel", "Story",
] as const;
