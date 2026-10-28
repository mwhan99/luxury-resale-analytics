/**
 * Reading the tracker spreadsheet. A copy of load_tracker() and derive() in calc.py.
 *
 * Missing numbers are NaN (like pandas), missing text and dates are null.
 * Every derived number is recalculated from the input columns, never read
 * from the spreadsheet's own formula cells.
 */

// Tracker column names (row 2 of the "Bags" sheet)
export const COL = {
  id: "Bag ID",
  brand: "Brand",
  model: "Model / style",
  condition: "Condition",
  source: "Supplier / source",
  sourcing: "Sourcing type",
  lot: "Lot ID",
  lot_total: "Lot total price (£)",
  purchase_date: "Purchase date",
  price_orig: "Purchase price (original currency)",
  fx: "FX rate to GBP",
  ship_in: "Shipping to London (£)",
  duty: "Import duty & VAT (£)",
  auth: "Authentication cost (£)",
  other: "Other costs (£)",
  channel: "Channel",
  date_listed: "Date listed",
  list_price: "First list price (£)",
  status: "Status",
  date_sold: "Date sold",
  sale: "Sale price (£)",
  payout: "Net payout received (£)",
  ship_out: "Seller-paid shipping / packaging (£)",
  confidence: "Data confidence",
  notes: "Notes",
} as const;

export const MIN_COMPS = 3; // fewer comparable sales than this = "not enough data"
export const SMALL_SAMPLE = 30; // below this, the app shows a small-sample warning

export type RawRow = Record<string, unknown>;

export type Bag = {
  id: string;
  brand: string | null;
  model: string | null;
  condition: string | null;
  source: string | null;
  sourcing: string;
  lot: string;
  channel: string | null;
  status: string | null;
  confidence: string | null;
  notes: string | null;
  lot_total: number;
  price_orig: number;
  fx: number;
  ship_in: number;
  duty: number;
  auth: number;
  other: number;
  list_price: number;
  sale: number;
  payout: number;
  ship_out: number;
  purchase_date: Date | null;
  date_listed: Date | null;
  date_sold: Date | null;
  // derived
  purchase_gbp: number;
  landed_cost: number;
  is_sold: boolean;
  fees: number;
  net_after_shipping: number;
  profit: number;
  margin: number;
  roi: number;
  fee_rate: number;
  days_to_sell: number;
};

/** pd.to_numeric(errors="coerce"): anything that isn't a plain number becomes NaN. */
export function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string") {
    const s = v.trim();
    if (s === "") return NaN;
    return /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s) ? Number(s) : NaN;
  }
  return NaN;
}

/** pd.to_datetime(errors="coerce", dayfirst=True). Dates come back as UTC midnight. */
export function toDate(v: unknown): Date | null {
  if (v instanceof Date) {
    return isNaN(v.getTime()) ? null : new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()));
  }
  if (typeof v !== "string") return null;
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return utc(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/); // day first, like the founder's UK sheet
  if (m) return utc(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  return null;
}

function utc(y: number, mo: number, d: number): Date | null {
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCMonth() === mo - 1 && date.getUTCDate() === d ? date : null;
}

/** .astype("string").str.strip(): blank cells are null, everything else is trimmed text. */
function toText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && isNaN(v)) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

/** Check the rows look like the tracker template; returns the missing column names. */
export function missingColumns(header: string[]): string[] {
  return Object.values(COL).filter((c) => !header.includes(c));
}

export function loadTracker(rows: RawRow[]): Bag[] {
  const kept = rows.filter((r) => {
    const id = r[COL.id];
    if (id === null || id === undefined || (typeof id === "number" && isNaN(id))) return false;
    const s = String(id);
    return s.trim() !== "" && s.toUpperCase() !== "EXAMPLE";
  });
  return kept.map((r) => {
    const num = (k: keyof typeof COL) => toNumber(r[COL[k]]);
    const fx = num("fx");
    return derive({
      id: String(r[COL.id]),
      brand: toText(r[COL.brand]),
      model: toText(r[COL.model]),
      condition: toText(r[COL.condition]),
      source: toText(r[COL.source]),
      sourcing: toText(r[COL.sourcing]) ?? "Unspecified",
      lot: toText(r[COL.lot]) ?? "No lot ID",
      channel: toText(r[COL.channel]),
      status: toText(r[COL.status]),
      confidence: toText(r[COL.confidence]),
      notes: toText(r[COL.notes]),
      lot_total: num("lot_total"),
      price_orig: num("price_orig"),
      fx: isNaN(fx) ? 1.0 : fx,
      ship_in: num("ship_in"),
      duty: num("duty"),
      auth: num("auth"),
      other: num("other"),
      list_price: num("list_price"),
      sale: num("sale"),
      payout: num("payout"),
      ship_out: num("ship_out"),
      purchase_date: toDate(r[COL.purchase_date]),
      date_listed: toDate(r[COL.date_listed]),
      date_sold: toDate(r[COL.date_sold]),
    });
  });
}

type Inputs = Omit<Bag, "purchase_gbp" | "landed_cost" | "is_sold" | "fees" | "net_after_shipping" |
  "profit" | "margin" | "roi" | "fee_rate" | "days_to_sell">;

const z = (x: number) => (isNaN(x) ? 0 : x); // fillna(0)
const positive = (x: number) => (x > 0 ? x : NaN); // .where(x > 0)

/** Add the calculated columns (same definitions as the spreadsheet). */
export function derive(b: Inputs): Bag {
  const purchase_gbp = b.price_orig * b.fx;
  const landed_cost = purchase_gbp + z(b.ship_in) + z(b.duty) + z(b.auth) + z(b.other);
  const is_sold = (b.status ?? "").toLowerCase() === "sold";
  const fees = is_sold ? b.sale - b.payout : NaN;
  const net_after_shipping = is_sold ? b.payout - z(b.ship_out) : NaN;
  const profit = is_sold ? net_after_shipping - landed_cost : NaN;
  const days =
    is_sold && b.date_sold && b.date_listed
      ? Math.floor((b.date_sold.getTime() - b.date_listed.getTime()) / 86_400_000)
      : NaN;
  return {
    ...b,
    purchase_gbp,
    landed_cost,
    is_sold,
    fees,
    net_after_shipping,
    profit,
    margin: profit / positive(b.sale),
    roi: profit / positive(landed_cost),
    fee_rate: fees / positive(b.sale),
    days_to_sell: days,
  };
}
