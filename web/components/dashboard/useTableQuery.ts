"use client";

import { useCallback, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { applyQuery, paramsToState, stateToParams } from "@/lib/table/query";
import type { TableConfig, QueryState, TableCtx } from "@/lib/table/types";

// Client hook binding a TableConfig to the URL: state is derived FROM the URL
// (shareable, refresh-safe, back/forward), and setState writes it back via a shallow
// replace. Filtering/sorting is the pure engine over the already-loaded rows.
// NOTE: pass a memoized `ctx` — it's a dependency of the filtered memo.
export function useTableQuery<Row>(rows: Row[], cfg: TableConfig<Row>, ctx: TableCtx = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const state = useMemo(() => paramsToState(cfg, sp), [cfg, sp]);

  const setState = useCallback(
    (next: QueryState) => {
      const qs = stateToParams(cfg, next).toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [cfg, pathname, router],
  );

  const filtered = useMemo(() => applyQuery(rows, cfg, state, ctx), [rows, cfg, state, ctx]);

  return { state, setState, filtered };
}
