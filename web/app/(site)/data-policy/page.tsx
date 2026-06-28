import type { Metadata } from "next";
import Link from "next/link";
import { PolicyPage } from "@/components/PolicyPage";

export const metadata: Metadata = {
  title: "Data Policy",
  description:
    "How the Matt Grant for Congress collects, uses, and protects your information. We collect only what we need and never sell it.",
};

export default function DataPolicyPage() {
  return (
    <PolicyPage
      eyebrow="Your privacy"
      title="Data Policy"
      updated="June 18, 2026"
      intro="The Matt Grant for Congress respects the people who support this campaign. This policy explains what information we collect, why, how we protect it, and the choices you have. We collect only what we need to run a campaign for Missouri's 2nd Congressional District, and we never sell your information."
    >
      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>When you contact or volunteer with us:</strong> your name, and the email, phone, city, interests,
          and any message you choose to provide.
        </li>
        <li>
          <strong>When you donate:</strong> contributions are processed by <strong>WinRed</strong>, not on this site.
          WinRed collects your payment and the donor information federal law requires. Our staff records contribution
          details (name, city, amount, and — for the FEC — employer and occupation) to meet our reporting duties.
        </li>
        <li>
          <strong>When you order print materials:</strong> the print studio sends your order to <strong>Walgreens</strong>,
          which handles it under its own privacy policy.
        </li>
        <li>
          <strong>Automatically:</strong> standard web and server logs and basic analytics needed to keep the site
          running and secure.
        </li>
      </ul>

      <h2>Why we collect it</h2>
      <ul>
        <li>To follow up with you about volunteering, events, and the campaign.</li>
        <li>To process and properly report contributions as federal law requires.</li>
        <li>To send campaign updates you&apos;ve asked to receive — and to stop when you ask.</li>
        <li>To operate, secure, and improve the website.</li>
      </ul>

      <h2>A contribution is public record</h2>
      <p>
        Federal law requires us to report contributions to the <strong>Federal Election Commission (FEC)</strong>. For
        contributors whose gifts exceed <strong>$200</strong> in an election cycle, the FEC publicly publishes your
        name, city, state, ZIP code, employer, occupation, and amount. This is required of every federal campaign and
        is outside our control. If you&apos;d rather your information not appear in public FEC records, keep your total
        contributions at or below the reporting threshold.
      </p>

      <h2>How we share it</h2>
      <ul>
        <li>
          <strong>We do not sell or rent</strong> your personal information.
        </li>
        <li>
          We share data only with service providers that help us operate (for example, our email sender and
          WinRed/Walgreens), and only as needed to provide that service.
        </li>
        <li>
          We disclose information when <strong>required by law</strong>, including FEC reporting.
        </li>
      </ul>

      <h2>Email and text choices</h2>
      <ul>
        <li>
          Every campaign newsletter and broadcast email includes an <strong>Unsubscribe</strong> link and a way to
          update your preferences. We honor opt-outs promptly (within 10 business days).
        </li>
        <li>
          Transactional messages (for example, a &ldquo;thanks for volunteering&rdquo; or donation receipt) may be
          sent without an unsubscribe link, but you can ask us to stop all contact at any time.
        </li>
        <li>
          If we text you, you can reply <strong>STOP</strong> to opt out. We only send automated texts to people who
          have consented to receive them.
        </li>
      </ul>

      <h2>How long we keep it, and how to reach us</h2>
      <ul>
        <li>
          We keep supporter and contribution records as long as needed for the campaign and to meet legal
          recordkeeping and FEC reporting obligations, then dispose of them securely.
        </li>
        <li>Access to donor and supporter data is limited to authorized campaign staff.</li>
        <li>
          To see, correct, or delete the information we hold about you (subject to records we must keep by law), email{" "}
          <a href="mailto:mattgrantforcongress@gmail.com?subject=Data%20Request">mattgrantforcongress@gmail.com</a>{" "}
          with the subject &ldquo;Data Request.&rdquo;
        </li>
      </ul>

      <h2>Security and children</h2>
      <p>
        We use reasonable safeguards to protect your information. No online system is perfectly secure. This site is
        not directed to children, and we do not knowingly collect information from anyone under 16.
      </p>

      <h2>Changes</h2>
      <p>
        We may update this policy as the campaign evolves or the law changes. We&apos;ll post the updated date at the
        top. See also our <Link href="/transparency">Transparency Policy</Link> and our{" "}
        <Link href="/public-trust">Commitment to Restoring Public Trust</Link>.
      </p>
    </PolicyPage>
  );
}
