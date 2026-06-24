import { describe, it, expect } from "vitest";
import { placeAcsUrl, zctaAcsUrl } from "./places";

describe("Census place/ZCTA URL builders (verified 2023 ACS5 geography)", () => {
  // URLSearchParams encodes spaces as '+'; normalize so we can assert readable clauses.
  const decode = (s: string) => decodeURIComponent(s).replace(/\+/g, " ");

  it("place query nests in state 29", () => {
    const u = decode(placeAcsUrl());
    expect(u).toContain("/acs/acs5");
    expect(u).toContain("for=place:*");
    expect(u).toContain("in=state:29");
    expect(u).toContain("NAME");
  });

  it("ZCTA query is bare — NO in=state clause (ZCTA does not nest in state)", () => {
    const u = decode(zctaAcsUrl(["63017", "63011"]));
    expect(u).toContain("for=zip code tabulation area:63017,63011");
    expect(u).not.toContain("in=state");
  });
});
