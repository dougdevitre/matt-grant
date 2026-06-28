import type { Metadata } from "next";
import Link from "next/link";
import { PolicyPage } from "@/components/PolicyPage";
import { CAMPAIGN, FEC } from "@/lib/site";

export const metadata: Metadata = {
  title: "Transparency Policy",
  description:
    "Who runs and pays for this campaign, how we're funded and report it, how we make claims, and how we handle corrections.",
};

export default function TransparencyPage() {
  return (
    <PolicyPage
      eyebrow="How we operate"
      title="Transparency Policy"
      updated="June 18, 2026"
      intro="We're asking voters to trust Matt Grant with their voice in Congress. Trust starts with being straight about who we are, who pays for this, and how we operate. This policy lays that out."
    >
      <h2>Who runs this site, and who pays for it</h2>
      <p>
        This website and its communications are produced and paid for by{" "}
        <strong>{CAMPAIGN.committee}</strong>, the principal campaign committee for Matt Grant&apos;s
        candidacy for the U.S. House of Representatives, Missouri&apos;s 2nd District, in the August 4, 2026 primary
        (FEC committee{" "}
        <Link href={FEC.profileUrl} target="_blank" rel="noopener noreferrer">{FEC.committeeId}</Link>).
        Every public communication carries the line &ldquo;{CAMPAIGN.paidForBy}&rdquo;
      </p>

      <h2>How we&apos;re funded and how we report it</h2>
      <ul>
        <li>
          Contributions are processed through <strong>WinRed</strong> and are <strong>not tax-deductible</strong>.
        </li>
        <li>
          We file regular reports with the <strong>Federal Election Commission (FEC)</strong> — the federal agency that
          oversees congressional campaign finance. (U.S. House candidates report to the FEC, not to the Missouri Ethics
          Commission.)
        </li>
        <li>
          Federal law caps how much an individual may give and <strong>prohibits</strong> contributions from
          corporations, labor unions, federal contractors, and foreign nationals. We use best efforts to collect and
          report donor information as the law requires.
        </li>
        <li>
          Our FEC filings are part of the <strong>public record</strong> and searchable at{" "}
          <a href="https://www.fec.gov" target="_blank" rel="noopener noreferrer">fec.gov</a>.
        </li>
      </ul>

      <h2>How we make claims and content</h2>
      <ul>
        <li>
          We represent Matt&apos;s stated positions faithfully and <strong>do not invent</strong> statistics, poll
          numbers, endorsements, or policy positions.
        </li>
        <li>
          We use AI-assisted tools to help draft and produce some campaign content. <strong>People review what we
          publish</strong>, and the responsibility for everything on this site is the campaign&apos;s, not a
          tool&apos;s.
        </li>
        <li>
          Campaign-finance and election information on this site is provided for general understanding and is{" "}
          <strong>not legal advice</strong>.
        </li>
      </ul>

      <h2>How we handle corrections</h2>
      <p>
        We try to get things right. If something here is inaccurate, tell us at{" "}
        <a href="mailto:mattgrantforcongress@gmail.com?subject=Correction">mattgrantforcongress@gmail.com</a> with the
        subject &ldquo;Correction.&rdquo; We&apos;ll review it promptly and fix genuine errors.
      </p>

      <h2>How we treat your data</h2>
      <p>
        How we collect and use personal information is described in our <Link href="/data-policy">Data Policy</Link>. In
        short: we collect only what we need, we never sell it, and you can opt out of our messages at any time.
      </p>

      <h2>How we treat the vote itself</h2>
      <p>
        We will not engage in voter suppression, disinformation, fake endorsements, astroturfing, or any tactic that
        deceives voters or undermines a fair election. For official voting information — registration, polling places,
        deadlines, and ID rules — we point you to the{" "}
        <a
          href="https://stlouiscountymo.gov/st-louis-county-government/board-of-elections/"
          target="_blank"
          rel="noopener noreferrer"
        >
          St. Louis County Board of Elections
        </a>{" "}
        and the Missouri Secretary of State, the authoritative sources. See also our{" "}
        <Link href="/public-trust">Commitment to Restoring Public Trust</Link>.
      </p>
    </PolicyPage>
  );
}
