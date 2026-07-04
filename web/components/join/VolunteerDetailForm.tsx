"use client";

import { useActionState } from "react";
import Link from "next/link";
import { submitVolunteerDetail } from "@/app/(site)/join/actions";
import type { IntakeResult } from "@/lib/volunteers/intake";
import {
  COMMITMENT_LEVELS,
  VOLUNTEER_MODES,
  VOLUNTEER_AVAILABILITY,
  VOLUNTEER_SKILLS,
  ROLE_CATEGORY_ORDER,
  ROLES_BY_CATEGORY,
} from "@/lib/volunteer/taxonomy";

const input =
  "mt-1 w-full rounded-sm border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink focus:ring-2 focus:ring-field/30";
const chip =
  "flex cursor-pointer items-center gap-2 rounded-sm border border-line px-3 py-2 text-sm text-ink hover:border-ink has-[:checked]:border-brick has-[:checked]:bg-brick/5";

// The structured volunteer/captain capture. Every option is the canonical Airtable
// vocabulary (Commitment / Roles / Skills / Mode / Availability) so the signup is
// matched to Active tasks the same way the Task Templates are tagged. `door`
// switches the small captain-only bits on. `defaultName/Email` prefill from the
// Clerk session; email is still resolved server-side from the session.
export function VolunteerDetailForm({
  door,
  defaultName = "",
  defaultEmail = "",
}: {
  door: "Volunteer" | "Team Captain";
  defaultName?: string;
  defaultEmail?: string;
}) {
  const [result, action, pending] = useActionState(
    async (_prev: IntakeResult | null, fd: FormData) => submitVolunteerDetail(_prev, fd),
    null,
  );
  const isCaptain = door === "Team Captain";

  if (result?.ok) {
    return (
      <div className="rounded-sm border border-field/40 bg-field/5 p-6">
        <p className="font-display text-xl font-semibold text-ink">
          {isCaptain ? "Thank you for stepping up to lead." : "Welcome to the team."}
        </p>
        <p className="mt-2 text-sm text-slate">{result.message}</p>
        <Link href="/community" className="btn-primary mt-4 inline-block">
          Go to your community hub →
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-7">
      <input type="hidden" name="door" value={door} />

      {/* Contact — name/email prefilled from the account; email is re-derived server-side */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-ink">
          <span className="font-semibold">Name</span>
          <input name="name" required defaultValue={defaultName} className={input} placeholder="Your name" />
        </label>
        <label className="text-sm text-ink">
          <span className="font-semibold">Email</span>
          <input name="email" type="email" defaultValue={defaultEmail} className={input} placeholder="you@email.com" />
        </label>
        <label className="text-sm text-ink">
          <span className="font-semibold">Mobile</span>
          <input name="phone" type="tel" className={input} placeholder="(314) 555-0123" />
        </label>
        <label className="text-sm text-ink">
          <span className="font-semibold">City</span>
          <input name="city" className={input} placeholder="St. Louis" />
        </label>
        <label className="text-sm text-ink">
          <span className="font-semibold">ZIP</span>
          <input name="zip" inputMode="numeric" maxLength={5} className={input} placeholder="63101" />
          <span className="mt-1 block text-xs text-slate">So we match you to local turf, lists, and events.</span>
        </label>
        <label className="text-sm text-ink">
          <span className="font-semibold">How you&apos;d like to help</span>
          <select name="mode" className={input} defaultValue="Either">
            {VOLUNTEER_MODES.map((m) => (
              <option key={m} value={m}>
                {m === "Digital" ? "From home / phone" : m === "In-person" ? "On the ground" : "Either"}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* SMS consent (TCPA) — only recorded when a phone is given. Field volunteers
          are exactly who we'd text shift reminders, so offer it here too. */}
      <label className="flex items-start gap-2 text-xs text-slate">
        <input type="checkbox" name="smsOptIn" value="1" className="mt-0.5 h-4 w-4 accent-brick" />
        <span>Text me shift reminders and time-sensitive updates. Msg &amp; data rates may apply; reply STOP to opt out.</span>
      </label>

      {/* Commitment Level — captain is implicitly Core, so this is volunteer-only */}
      {!isCaptain && (
        <fieldset>
          <legend className="text-sm font-semibold text-ink">How much time can you give?</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {COMMITMENT_LEVELS.map((c, i) => (
              <label key={c.name} className={chip}>
                <input type="radio" name="commitmentLevel" value={c.name} defaultChecked={i === 0} className="h-4 w-4 accent-brick" />
                <span>
                  <span className="font-semibold">{c.name}</span>{" "}
                  <span className="text-slate">· {c.hours}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {/* Roles, grouped by category */}
      <fieldset>
        <legend className="text-sm font-semibold text-ink">What kind of work interests you?</legend>
        <div className="mt-3 space-y-4">
          {ROLE_CATEGORY_ORDER.map((cat) => (
            <div key={cat}>
              <p className="eyebrow text-slate">{cat}</p>
              <div className="mt-1.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {ROLES_BY_CATEGORY[cat].map((r) => (
                  <label key={r.name} className={chip} title={r.blurb}>
                    <input type="checkbox" name="roleInterests" value={r.name} className="h-4 w-4 accent-brick" />
                    {r.name}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      {/* Skills */}
      <fieldset>
        <legend className="text-sm font-semibold text-ink">What skills do you bring?</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {VOLUNTEER_SKILLS.map((s) => (
            <label key={s.name} className={chip}>
              <input type="checkbox" name="skills" value={s.name} className="h-4 w-4 accent-brick" />
              {s.label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Availability */}
      <fieldset>
        <legend className="text-sm font-semibold text-ink">When are you available?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {VOLUNTEER_AVAILABILITY.map((a) => (
            <label key={a} className={chip}>
              <input type="checkbox" name="availability" value={a} className="h-4 w-4 accent-brick" />
              {a}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Captain-only: why you want to lead */}
      {isCaptain && (
        <label className="block text-sm text-ink">
          <span className="font-semibold">Why do you want to lead a team?</span>
          <textarea name="captainNote" rows={3} className={input} placeholder="Tell us about your experience and the neighbors you can rally." />
          <span className="mt-1 block text-xs text-slate">
            A captain manages 5–10 volunteers. An organizer will review and follow up about training.
          </span>
        </label>
      )}

      <label className="block text-sm text-ink">
        <span className="font-semibold">Anything else? (optional)</span>
        <textarea name="message" rows={2} className={input} placeholder="Questions, availability notes, or how you heard about us." />
      </label>

      {result && !result.ok && <p className="text-sm text-brick">{result.message}</p>}
      <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">
        {pending ? "Submitting…" : isCaptain ? "Apply to lead a team" : "Join the team"}
      </button>
    </form>
  );
}
