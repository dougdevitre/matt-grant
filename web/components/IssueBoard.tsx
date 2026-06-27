import { listPublishedTopics } from "@/lib/issue-board/airtable";

// Public bulletin board of community-submitted topics that a human has approved
// in Airtable. Server component: fetches at request time (cached ~5 min in the
// lib). Renders nothing-but-the-empty-state when there are no approved topics yet,
// so the section never looks broken on a fresh board or a keyless build.
export async function IssueBoard() {
  const { topics } = await listPublishedTopics();

  return (
    <div>
      <p className="eyebrow text-brick">Community voices</p>
      <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">What MO-02 is talking about.</h2>
      <p className="mt-3 max-w-prose text-slate">
        Topics submitted by supporters and approved by the campaign. Shared anonymously.
      </p>

      {topics.length === 0 ? (
        <p className="mt-8 rounded-sm border border-dashed border-line bg-white px-5 py-6 text-slate">
          No topics posted yet — be the first. Submit yours above and, once we&apos;ve reviewed it, it&apos;ll
          show up here.
        </p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {topics.map((t) => (
            <li key={t.id} className="card flex flex-col p-6">
              <h3 className="font-display text-lg font-semibold text-ink">{t.topic}</h3>
              {t.details && <p className="mt-2 whitespace-pre-line text-slate">{t.details}</p>}
              <p className="mt-4 font-mono text-xs uppercase tracking-eyebrow text-gold">— A supporter in MO-02</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
