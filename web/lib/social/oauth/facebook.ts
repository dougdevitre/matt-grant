import { authorizeUrl as metaAuthorize, exchangeCode as metaExchange, refreshConnection } from "@/lib/social/metaOAuth";
import type { OAuthProvider } from "@/lib/social/oauth/types";

// Meta provider — powers both Facebook (Page) and Instagram (linked IG account)
// from one connect. Thin adapter over the existing metaOAuth logic.
export const facebookProvider: OAuthProvider = {
  platform: "facebook",
  authorizeUrl: (state) => metaAuthorize(state),
  exchangeCode: (code) => metaExchange(code),
  refresh: (conn) => refreshConnection(conn),
};
