import type { Metadata } from "next";
import Link from "next/link";
import { verifyVolunteerToken } from "@/lib/volunteer-link";
import { getVolunteer, getVolunteerTasks } from "@/lib/queries";
import { CAMPAIGN } from "@/lib/site";
import { volunteerSetTaskStatus } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My tasks", robots: { index: false } };

const STATUS_LABEL: Record<string, string> = { TODO: "To do", DOING: "In progress", DONE: "Done" };
const primaryBtn = "rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper hover:bg-brick";

export default async function MyTasksPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const volunteerId = await verifyVolunteerToken(token);
  const v = volunteerId ? await getVolunteer(volunteerId) : null;

  if (!v) {
    return (
      <section className="container-page py-16 sm:py-24">
        <h1 className="text-3xl font-semibold text-ink sm:text-4xl">This link isn&apos;t valid.</h1>
        <p className="mt-4 max-w-prose text-lg text-slate">
          It may have expired or been mistyped. Ask your team captain to resend it, or{" "}
          <Link href="/act" className="text-field underline">build your own action plan</Link>.
        </p>
      </section>
    );
  }

  const tasks = await getVolunteerTasks(v.id);
  const open = tasks.filter((t) => t.status !== "DONE");
  const done = tasks.filter((t) => t.status === "DONE");
  const first = (v.name || "").split(" ")[0] || "there";

  return (
    <section className="container-page py-16 sm:py-24">
      <p className="eyebrow text-brick">{CAMPAIGN.candidate} · Volunteer</p>
      <h1 className="mt-3 text-4xl font-semibold text-ink sm:text-5xl">Hi {first} — here&apos;s your list.</h1>
      <p className="mt-4 max-w-prose text-lg text-slate">
        Thanks for pitching in. Tap <span className="font-semibold">Accept</span> to take a task, and{" "}
        <span className="font-semibold">Mark done</span> when you&apos;ve finished — your captain sees it update live.
      </p>

      {tasks.length === 0 ? (
        <div className="mt-10 rounded-lg border border-line bg-paper p-10 text-center text-slate">
          Nothing assigned right now. Your captain will add tasks here — check back soon, or{" "}
          <Link href="/act" className="text-field underline">start an action plan</Link>.
        </div>
      ) : (
        <div className="mt-10 space-y-4">
          {open.map((t) => (
            <div key={t.id} className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-mono text-[0.6rem] uppercase tracking-eyebrow text-gold">{STATUS_LABEL[t.status] ?? t.status}</p>
                <h2 className="mt-1 font-display text-xl font-semibold text-ink">{t.title}</h2>
                {t.detail && <p className="mt-1 text-sm text-slate">{t.detail}</p>}
              </div>
              <div className="flex shrink-0 gap-2">
                {t.status === "TODO" && (
                  <form action={volunteerSetTaskStatus}>
                    <input type="hidden" name="token" value={token} />
                    <input type="hidden" name="taskId" value={t.id} />
                    <input type="hidden" name="status" value="DOING" />
                    <button type="submit" className="btn-ghost px-4 py-2 text-sm">Accept</button>
                  </form>
                )}
                <form action={volunteerSetTaskStatus}>
                  <input type="hidden" name="token" value={token} />
                  <input type="hidden" name="taskId" value={t.id} />
                  <input type="hidden" name="status" value="DONE" />
                  <button type="submit" className={primaryBtn}>Mark done ✓</button>
                </form>
              </div>
            </div>
          ))}

          {done.length > 0 && (
            <div className="pt-4">
              <p className="eyebrow text-slate">Completed ({done.length})</p>
              <ul className="mt-2 divide-y divide-line">
                {done.map((t) => (
                  <li key={t.id} className="py-2 text-sm text-slate line-through">{t.title}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
