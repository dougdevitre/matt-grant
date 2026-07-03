// One accessible seam for every demographic chart. Renders the in-app SVG (BarChart)
// when the chart defines chart() geometry, with the validated data table as the
// always-present accessible fallback in a <details>; otherwise it is table-first.
// The text alternative (alt) and the source citation are ALWAYS present, never
// image-only. Server component.
import { CHARTS } from "@/lib/demographics/charts";
import { BarChart } from "./BarChart";

const fmt = (v: string | number) => (typeof v === "number" ? v.toLocaleString("en-US") : v);

// The demographic figure's own data table (distinct from the dashboard <DataTable>).
function FigureTable({ id }: { id: string }) {
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
              <FigureTable id={c.id} />
            </div>
          </details>
        </>
      ) : (
        <>
          {/* Table-first: the alt sentence carries the takeaway, the table carries the data. */}
          <p className="mb-3 max-w-prose text-sm text-slate">{c.alt}</p>
          <FigureTable id={c.id} />
        </>
      )}

      <p className="mt-3 font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate">Source: {c.source}</p>
    </figure>
  );
}
