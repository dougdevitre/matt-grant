// Shown inside the dashboard layout while a data-heavy page streams in.
export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6 motion-reduce:animate-none">
      <div className="h-7 w-44 rounded bg-line" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-lg bg-line/60" />
        ))}
      </div>
      <div className="h-44 rounded-lg bg-line/50" />
    </div>
  );
}
