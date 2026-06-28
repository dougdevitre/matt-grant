#!/usr/bin/env python3
"""
Geographic units for script localization — MO-02 and its five counties.

Scope is grounded in `candidate/data-and-map-plan.md`: under the new 2025 map
(in effect for the August 4, 2026 primary), MO-02 covers the western/central
St. Louis County suburbs plus four counties to the south — Jefferson,
Washington, Crawford, and Gasconade.

Each unit carries only **safe, real anchors**: the county name and a short,
factual description of its character. Anything finer than a county (specific
school districts, zip codes, courthouse names) is intentionally NOT encoded
here — when a script needs that level of detail it emits a clearly labeled
merge token like [SCHOOL DISTRICT], never an invented fact. (See README.)
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Geo:
    key: str
    name: str            # display name, e.g. "St. Louis County"
    level: str           # "district" | "county"
    region_hook: str     # short localized phrase dropped into copy: "{region_hook}"
    descriptor: str      # one-clause factual description for longer scripts


GEOS = [
    Geo("mo02", "Missouri's 2nd District", "district",
        "across Missouri's 2nd District",
        "Missouri's 2nd Congressional District — the St. Louis County suburbs "
        "and the counties to the south"),
    Geo("stlouis", "St. Louis County", "county",
        "here in west St. Louis County",
        "the suburban communities of western and central St. Louis County — "
        "from Chesterfield and Wildwood to Ballwin, Kirkwood, Town and Country, "
        "Creve Coeur, and Maryland Heights"),
    Geo("jefferson", "Jefferson County", "county",
        "here in Jefferson County",
        "the suburb-to-exurb communities of Jefferson County, just south of the city"),
    Geo("washington", "Washington County", "county",
        "here in Washington County",
        "rural Washington County, in the southern reach of MO-02"),
    Geo("crawford", "Crawford County", "county",
        "here in Crawford County",
        "rural Crawford County, in the southern reach of MO-02"),
    Geo("gasconade", "Gasconade County", "county",
        "here in Gasconade County",
        "rural Gasconade County, in the southern reach of MO-02"),
]

GEOS_BY_KEY = {g.key: g for g in GEOS}


def localize(text: str, geo: Geo) -> str:
    """Fill the geo merge tokens in a script body. Unknown tokens are left
    untouched so the generator can surface them (e.g. [SCHOOL DISTRICT])."""
    return (text
            .replace("{geo_name}", geo.name)
            .replace("{region_hook}", geo.region_hook)
            .replace("{descriptor}", geo.descriptor))


if __name__ == "__main__":
    for g in GEOS:
        print(f"{g.key:<11}{g.level:<10}{g.name}")
