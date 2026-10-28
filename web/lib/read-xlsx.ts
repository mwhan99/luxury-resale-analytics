/** Read the tracker's "Bags" sheet from an .xlsx file, in the browser (or in tests). */
import { loadTracker, missingColumns, type Bag, type RawRow } from "./tracker";

export async function readTracker(data: ArrayBuffer): Promise<Bag[]> {
  const XLSX = await import("xlsx"); // only downloaded when someone opens a file
  const wb = XLSX.read(data, { cellDates: true });
  const sheet = wb.Sheets["Bags"];
  if (!sheet) throw new Error("This doesn't look like the tracker template: there is no \"Bags\" sheet.");
  // Row 1 holds group titles; the column names are on row 2.
  const header = (XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, range: 1 })[0] ?? [])
    .map((h) => String(h ?? "").trim());
  const missing = missingColumns(header);
  if (missing.length) throw new Error(`This doesn't look like the tracker template. Missing columns: ${missing.join(", ")}`);
  const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, { range: 1, defval: null, raw: true });
  return loadTracker(rows);
}
