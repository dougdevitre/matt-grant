// One accessible seam for every demographic chart. Renders the committed
// Datawrapper SVG export when it exists (web/public/charts/<id>.svg, same-origin);
// until then it is table-first — the validated data renders as a real table so the
// figure is useful and WCAG-clean immediately. The text alternative (alt) and the
// source citation are ALWAYS present, never image-only. Server component.
import { CHARTS } from "@/lib/demographics/charts";
import { BarChart } from "./BarChart";

const fmt = (v: string | number) => (typeof v === "number" ? v.toLocaleString("en-US") : v);

function DataTable({ id }: { id: string }) {
  const { columns, rows } = CHARTS[id].table();
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{CHARTS[id].title} — data table</caption>
        <thead>
          <tr className="border-b border-line text-left">
            {columns.map((c) => (
              <th key={c} scope="col" className="px-3 py-2 font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line/60">
              {r.map((cell, j) => (
                <td key={j} className={`px-3 py-1.5 text-ink ${j === 0 ? "" : "text-right tabular-nums"}`}>
                  {fmt(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Figure({ id }: { id: string }) {
  const c = CHARTS[id];
  if (!c) return null;

  return (
    <figure className="my-8 rounded-sm border border-line bg-white p-5">
      <figcaption className="mb-3">
        <h3 className="font-display text-lg font-semibold text-ink">{c.title}</h3>
      </figcaption>

      {c.chart ? (
        <>
          {/* In-app SVG (decorative). The alt sentence + the data table below are the
              text alternative, so the takeaway is never image-only. */}
          <p className="mb-3 max-w-prose text-sm text-slate">{c.alt}</p>
          <BarChart spec={c.chart()} labelGutter={c.chartGutter} />
          <details className="mt-3">
            <summary className="cursor-pointer font-mono text-[0.6rem] uppercase tracking-eyebrow text-field">
              Show data table
            </summary>
            <div className="mt-2">
              <DataTable id={c.id} />
            </div>
          </details>
        </>
      ) : c.hasExport ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/charts/${c.id}.svg`} alt={c.alt} className="w-full" />
          <details className="mt-3">
            <summary className="cursor-pointer font-mono text-[0.6rem] uppercase tracking-eyebrow text-field">
              Show data table
            </summary>
            <div className="mt-2">
              <DataTable id={c.id} />
            </div>
          </details>
        </>
      ) : (
        <>
          {/* Table-first: the alt sentence carries the takeaway, the table carries the data. */}
          <p className="mb-3 max-w-prose text-sm text-slate">{c.alt}</p>
          <DataTable id={c.id} />
        </>
      )}

      <p className="mt-3 font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate">Source: {c.source}</p>
    </figure>
  );
}
