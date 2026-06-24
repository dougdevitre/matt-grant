// Typed loader for the print tracker — the reference slice for the Resource pattern.
// Validates the committed manifest (web/lib/printTracker.json, generated from
// candidate/letters/print-tracker.csv) row-by-row and hands back a Resource<PrintItem[]>.
import { z } from "zod";
import manifest from "@/lib/printTracker.json";
import { loadCsvManifest } from "./csv";
import type { Resource } from "./resource";

export const PrintItemSchema = z.object({
  item: z.string(),
  category: z.string(),
  template: z.string(),
  sheet_size: z.string(),
  disclaimer_required: z.string(),
  solicitation_tax_line: z.string(),
  internal_only: z.string(),
  quantity: z.string(),
  vendor: z.string(),
  unit_cost: z.string(),
  order_by_date: z.string(),
  in_hand_date: z.string(),
  status: z.string(),
});

export type PrintItem = z.infer<typeof PrintItemSchema>;

export function loadPrintTracker(): Resource<PrintItem[]> {
  return loadCsvManifest(manifest, PrintItemSchema, {
    source: manifest.generatedFrom ?? "candidate/letters/print-tracker.csv",
  });
}
