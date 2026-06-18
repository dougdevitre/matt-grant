import type { Metadata } from "next";
import Link from "next/link";
import { PolicyPage } from "@/components/PolicyPage";

export const metadata: Metadata = {
  title: "Our Commitment to Restoring Public Trust",
  description:
    "Government works best when people can trust it. This campaign commits to telling the truth, showing our work, respecting your data, and protecting the vote.",
};

export default function PublicTrustPage() {
  return (
    <PolicyPage
      eyebrow="Our commitment"
      title="Restoring Public Trust"
      updated="June 18, 2026"
      intro="Government works best when the people it serves can trust it. Too often, they can't — and they have good reason. This campaign is built on earning that trust back, starting with how we run the campaign itself."
    >
      <h2>What we believe</h2>
      <p>
        Public service is a responsibility, not a career or a reward. The institutions that touch families&apos; lives
        — courts, agencies, the offices we elect — should be <strong>open, accountable, and answerable to the
        people</strong>, not to insiders. Matt&apos;s platform reflects that: opening up the family-court system
        through the proposed CHILD Protection Act, term limits so service doesn&apos;t harden into careerism, a leaner
        federal government, and cutting waste before asking taxpayers for more.
      </p>

      <h2>How we&apos;ll hold ourselves to it</h2>
      <p>We can&apos;t ask for accountability in Washington without practicing it here. So this campaign commits to:</p>
      <ol>
        <li>
          <strong>Tell the truth.</strong> We won&apos;t invent statistics, fake endorsements, or put words in
          opponents&apos; mouths. We represent Matt&apos;s real positions and correct our mistakes when we make them.
        </li>
        <li>
          <strong>Show our work.</strong> Who funds and runs this campaign is public — in our FEC filings and in our{" "}
          <Link href="/transparency">Transparency Policy</Link>.
        </li>
        <li>
          <strong>Respect your data.</strong> We collect only what we need, never sell it, and let you opt out anytime.
          See our <Link href="/data-policy">Data Policy</Link>.
        </li>
        <li>
          <strong>Protect the vote.</strong> No suppression, no disinformation, no dirty tricks. We point voters to
          official election sources and want every eligible neighbor to vote — however they vote.
        </li>
        <li>
          <strong>Be reachable.</strong> Real contact information, real people, real responses. If we get something
          wrong, tell us and we&apos;ll fix it.
        </li>
      </ol>

      <h2>The standard we&apos;re running on</h2>
      <p>
        A campaign that cuts corners can&apos;t credibly promise clean government. Restoring public trust isn&apos;t a
        slogan we&apos;ll retire on Election Day — it&apos;s the way we intend to operate, before and after August 4,
        2026.
      </p>
      <p>
        If we ever fall short of this commitment, hold us to it:{" "}
        <a href="mailto:mattgrantforcongress@gmail.com">mattgrantforcongress@gmail.com</a>.
      </p>
    </PolicyPage>
  );
}
