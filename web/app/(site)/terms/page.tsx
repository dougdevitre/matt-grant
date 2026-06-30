import type { Metadata } from "next";
import Link from "next/link";
import { PolicyPage } from "@/components/PolicyPage";
import { CAMPAIGN } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "The terms for using the Matt Grant for Congress website — how you may use it, what we ask of contributors and visitors, and the limits on our responsibility.",
};

export default function TermsPage() {
  return (
    <PolicyPage
      eyebrow="The fine print"
      title="Terms of Use"
      updated="June 30, 2026"
      intro="These terms govern your use of this website, operated by the Matt Grant for Congress committee. By using the site, you agree to them. We've kept them short and plain. They sit alongside our Data Policy and Transparency Policy, which explain how we handle your information and how we operate."
    >
      <h2>Who runs this site</h2>
      <p>
        This website is published and paid for by <strong>{CAMPAIGN.committee}</strong>, the principal campaign
        committee for Matt Grant&apos;s candidacy for the U.S. House of Representatives, Missouri&apos;s 2nd
        Congressional District, in the August 4, 2026 primary. You can reach us at{" "}
        <a href={`mailto:${CAMPAIGN.email}`}>{CAMPAIGN.email}</a> or {CAMPAIGN.phone}.
      </p>

      <h2>Using the site</h2>
      <ul>
        <li>You may read, share, and link to our content for personal, non-commercial, and civic purposes.</li>
        <li>
          Please don&apos;t use the site to break the law, harass others, post false or misleading information, scrape
          or harvest data, attempt to gain unauthorized access, or interfere with how the site runs.
        </li>
        <li>
          Don&apos;t use our name, logo, or materials to suggest an endorsement or affiliation that doesn&apos;t exist,
          or in a way that could mislead voters about who is speaking.
        </li>
      </ul>

      <h2>Contributions and donations</h2>
      <p>
        Donations are processed by <strong>WinRed</strong>, not on this site, and are also subject to WinRed&apos;s own
        terms. Political contributions are governed by federal law. By contributing, you confirm that:
      </p>
      <ul>
        <li>You are a U.S. citizen or lawfully admitted permanent resident (a green-card holder).</li>
        <li>The contribution is made from your own funds, not those of another person or entity.</li>
        <li>The funds are not from a corporation, labor organization, federal contractor, or foreign national.</li>
        <li>You are making the contribution on a personal credit or debit card, not a corporate one, and you are at least 18.</li>
      </ul>
      <p>
        Contributions to a political committee are <strong>not tax-deductible</strong>. Federal law requires us to
        report certain contributor information to the Federal Election Commission — see our{" "}
        <Link href="/data-policy">Data Policy</Link> and <Link href="/transparency">Transparency Policy</Link> for
        details. For a refund or to correct a contribution, email{" "}
        <a href={`mailto:${CAMPAIGN.email}?subject=Contribution%20Question`}>{CAMPAIGN.email}</a>.
      </p>

      <h2>Print materials and third-party services</h2>
      <p>
        Some features rely on third parties — for example, the print studio sends orders to <strong>Walgreens</strong>,
        and donations run through WinRed. When you use those features, the third party&apos;s own terms and policies
        also apply. We don&apos;t control and aren&apos;t responsible for third-party websites or services we link to.
      </p>

      <h2>Anything you submit</h2>
      <p>
        If you send us a message, sign up to volunteer, or otherwise submit content, you confirm it&apos;s yours to
        share and is accurate, and you give us permission to use it to run and report on the campaign as described in
        our <Link href="/data-policy">Data Policy</Link>. Don&apos;t submit anything unlawful, threatening, or that
        infringes someone else&apos;s rights. We may remove content or decline submissions at our discretion.
      </p>

      <h2>Our content</h2>
      <p>
        The text, graphics, and design on this site belong to the campaign or are used with permission, except where a
        source is credited. Official government data, FEC records, and material we cite remain the property of their
        owners. You may quote or share our content with attribution for non-commercial civic use; please don&apos;t
        repackage it commercially or in a way that misrepresents the campaign&apos;s positions.
      </p>

      <h2>No warranty; limitation of liability</h2>
      <p>
        We work to keep this site accurate and available, but we provide it &ldquo;as is,&rdquo; without warranties of
        any kind. Information here is for general civic and educational purposes and is not legal, financial, or tax
        advice. To the fullest extent allowed by law, the campaign is not liable for any damages arising from your use
        of the site or reliance on its content.
      </p>

      <h2>Changes and governing law</h2>
      <p>
        We may update these terms as the campaign evolves or the law changes; we&apos;ll post the updated date at the
        top. These terms are governed by the laws of the State of Missouri and applicable federal law, including the
        Federal Election Campaign Act and FEC regulations. If any part of these terms is found unenforceable, the rest
        stays in effect.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms? Email{" "}
        <a href={`mailto:${CAMPAIGN.email}?subject=Terms%20of%20Use`}>{CAMPAIGN.email}</a> or write to us at the
        committee address below.
      </p>
    </PolicyPage>
  );
}
