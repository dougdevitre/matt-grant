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
      intro="These terms are a binding agreement that governs your use of this website, operated by the Matt Grant for Congress committee. By accessing or using the site, you agree to them. If you do not agree, please do not use the site. They sit alongside our Data Policy and Transparency Policy, which explain how we handle your information and how we operate."
    >
      <h2>Who runs this site</h2>
      <p>
        This website is published and paid for by <strong>{CAMPAIGN.committee}</strong> (the &ldquo;Committee,&rdquo;
        &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), the principal campaign committee for Matt
        Grant&apos;s candidacy for the U.S. House of Representatives, Missouri&apos;s 2nd Congressional District, in the
        August 4, 2026 primary. You can reach us at <a href={`mailto:${CAMPAIGN.email}`}>{CAMPAIGN.email}</a> or{" "}
        {CAMPAIGN.phone}. In these terms, &ldquo;you&rdquo; means anyone who accesses or uses the site.
      </p>

      <h2>Using the site</h2>
      <ul>
        <li>You may read, share, and link to our content for personal, non-commercial, and civic purposes.</li>
        <li>
          You agree not to use the site to break the law, harass or harm others, post false or misleading information,
          impersonate anyone, upload malware, scrape or harvest data, probe or test the security of the site, attempt
          to gain unauthorized access to any system or account, place an undue load on our infrastructure, or interfere
          with how the site runs.
        </li>
        <li>
          Don&apos;t use our name, logo, or materials to suggest an endorsement, affiliation, or authorization that
          doesn&apos;t exist, or in any way that could mislead voters about who is speaking.
        </li>
        <li>
          We may suspend, restrict, or terminate your access at any time, with or without notice, if we believe you
          have violated these terms or to protect the site, our supporters, or the campaign.
        </li>
      </ul>

      <h2>Educational information, not advice</h2>
      <p>
        Everything on this site is provided for general civic, educational, and informational purposes only. It is{" "}
        <strong>not legal, financial, tax, investment, or professional advice</strong>, and it does not create any
        advisor, fiduciary, or other special relationship between you and the Committee. Do not rely on this site as a
        substitute for advice from a qualified professional or for official sources. Any action you take based on this
        site is at your own risk.
      </p>

      <h2>Campaign statements and forward-looking information</h2>
      <p>
        This site describes Matt Grant&apos;s priorities, positions, and proposals. These are statements of political
        intent and opinion, not guarantees, contracts, or promises of any specific outcome, vote, or result.
        Legislative proposals, policy positions, plans, schedules, and any projections or illustrative figures are
        forward-looking and may change at any time without notice as circumstances, facts, and the law evolve. We make
        no representation or warranty that any stated goal will be achieved, and nothing on this site should be relied
        upon as a commitment on which you take action.
      </p>

      <h2>Voting and election information</h2>
      <p>
        This is a campaign website, not a government site or an official source of election information. Any references
        to registration, deadlines, polling places, or ballots are for general convenience only and may be incomplete
        or out of date. Always confirm voting details with the{" "}
        <a href="https://www.sos.mo.gov/elections" target="_blank" rel="noopener noreferrer">
          Missouri Secretary of State
        </a>{" "}
        or your local election authority. We are not responsible for any reliance on election information found here.
      </p>

      <h2>Contributions and donations</h2>
      <p>
        Donations are processed by <strong>WinRed</strong>, not on this site, and are also subject to WinRed&apos;s own
        terms and privacy policy. Political contributions are governed by federal law. By contributing, you confirm
        that:
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
        <a href={`mailto:${CAMPAIGN.email}?subject=Contribution%20Question`}>{CAMPAIGN.email}</a>. We are not
        responsible for errors, delays, fees, or losses caused by WinRed, your card issuer, or your bank.
      </p>

      <h2>Print materials and third-party services</h2>
      <p>
        Some features rely on third parties — for example, the print studio sends orders to <strong>Walgreens</strong>,
        and donations run through WinRed. When you use those features, the third party&apos;s own terms and policies
        also apply, and your dealings with them are solely between you and them. The site may also link to other
        websites and resources. We do not control, endorse, or assume any responsibility for any third-party website,
        service, content, product, or transaction, and a link or mention is not an endorsement.
      </p>

      <h2>Anything you submit</h2>
      <p>
        If you send us a message, sign up to volunteer, or otherwise submit content, you confirm it is yours to share,
        is accurate, and does not violate the law or anyone&apos;s rights, and you grant the Committee a non-exclusive,
        royalty-free, worldwide license to use it to run and report on the campaign as described in our{" "}
        <Link href="/data-policy">Data Policy</Link>. Don&apos;t submit anything unlawful, defamatory, threatening,
        infringing, or confidential. We are not responsible for content submitted by users, and we may remove content,
        decline submissions, or take other action at our discretion and without liability.
      </p>

      <h2>Our content</h2>
      <p>
        The text, graphics, and design on this site belong to the campaign or are used with permission, except where a
        source is credited. Official government data, FEC records, and material we cite remain the property of their
        owners. You may quote or share our content with attribution for non-commercial civic use; please don&apos;t
        repackage it commercially or in a way that misrepresents the campaign&apos;s positions. If you believe content
        on this site infringes your copyright, email{" "}
        <a href={`mailto:${CAMPAIGN.email}?subject=Copyright%20Notice`}>{CAMPAIGN.email}</a> with the details and
        we&apos;ll review it.
      </p>

      <h2>No warranty — the site is provided &ldquo;as is&rdquo;</h2>
      <p>
        We work to keep this site accurate and available, but to the fullest extent permitted by law the site and all
        of its content are provided <strong>&ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without warranties of
        any kind</strong>, whether express, implied, or statutory, including any implied warranties of merchantability,
        fitness for a particular purpose, title, accuracy, and non-infringement. We do not warrant that the site will
        be uninterrupted, secure, error-free, or free of harmful components, or that any information on it is complete,
        current, or accurate. Your use of the site is at your sole risk.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, the Committee and its officers, staff, volunteers, vendors, and agents
        (the &ldquo;Released Parties&rdquo;) will <strong>not be liable</strong> for any indirect, incidental, special,
        consequential, exemplary, or punitive damages, or for any loss of data, goodwill, profits, or opportunity,
        arising out of or relating to your use of (or inability to use) the site, its content, or any third-party
        service, whether based in contract, tort, negligence, strict liability, or any other legal theory, and even if
        we have been advised of the possibility of such damages. In no event will the Released Parties&apos; total
        aggregate liability for all claims relating to the site exceed <strong>one hundred U.S. dollars ($100)</strong>.
        Some jurisdictions do not allow certain limitations, so some of these may not apply to you; nothing in these
        terms limits any liability that cannot be limited or excluded under applicable law.
      </p>

      <h2>Indemnification</h2>
      <p>
        You agree to defend, indemnify, and hold harmless the Released Parties from and against any claims, damages,
        losses, liabilities, costs, and expenses (including reasonable attorneys&apos; fees) arising out of or related
        to your use of the site, your content or submissions, or your violation of these terms or of any law or
        third-party right.
      </p>

      <h2>Disputes and time limit to bring a claim</h2>
      <p>
        If you have a concern, please contact us first at{" "}
        <a href={`mailto:${CAMPAIGN.email}?subject=Terms%20Dispute`}>{CAMPAIGN.email}</a> so we can try to resolve it
        informally. These terms are governed by the laws of the State of Missouri and applicable federal law, including
        the Federal Election Campaign Act and FEC regulations, without regard to conflict-of-law rules. You agree that
        any dispute that is not resolved informally will be brought exclusively in the state or federal courts located
        in St. Louis County, Missouri, and you consent to their jurisdiction. <strong>Any claim relating to the site
        must be filed within one (1) year</strong> after it arises, or it is permanently barred, to the extent
        permitted by law.
      </p>

      <h2>Changes to these terms and the site</h2>
      <p>
        We may update these terms as the campaign evolves or the law changes; we&apos;ll post the updated date at the
        top, and your continued use of the site means you accept the changes. We may also modify, suspend, or
        discontinue any part of the site at any time without notice or liability.
      </p>

      <h2>General</h2>
      <p>
        These terms, together with our <Link href="/data-policy">Data Policy</Link> and{" "}
        <Link href="/transparency">Transparency Policy</Link>, are the entire agreement between you and the Committee
        about the site. If any provision is found unenforceable, the rest stays in effect, and the unenforceable
        provision will be applied to the maximum extent permitted. Our failure to enforce any provision is not a waiver
        of it. You may not assign these terms; we may assign them as permitted by law. Section headings are for
        convenience only.
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
