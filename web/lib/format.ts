/** Number display helpers. "–" stands for a number that can't be worked out. */

const bad = (x: number | null | undefined): x is null | undefined => x === null || x === undefined || !isFinite(x);

/** £1,234 or -£1,234 (the minus goes before the £, as in the Streamlit app). */
export function gbp(x: number | null | undefined, dp = 0): string {
  if (bad(x)) return "–";
  const s = Math.abs(x).toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });
  return (x < 0 && s.replace(/[0.,]/g, "") !== "" ? "-£" : "£") + s;
}

/** 0.25 → "25%". */
export function pct(x: number | null | undefined, dp = 0): string {
  return bad(x) ? "–" : `${(x * 100).toFixed(dp)}%`;
}

/** 0.25 → "+25%". */
export const signedPct = (x: number | null | undefined) => (bad(x) ? "–" : `${x >= 0 ? "+" : ""}${pct(x)}`);

/** 4.97 → "5.0×" (return per £ shown as a multiple when it is large). */
export const times = (x: number | null | undefined) => (bad(x) ? "–" : `${x.toFixed(1)}×`);

export const num = (x: number | null | undefined, dp = 0) =>
  bad(x) ? "–" : x.toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });
