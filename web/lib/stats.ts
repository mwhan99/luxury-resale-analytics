/** Small pandas look-alikes. NaN values are skipped, as pandas does by default. */

export const valid = (xs: number[]) => xs.filter((x) => !isNaN(x));

/** Series.sum(): NaN skipped, an empty list sums to 0. */
export const sum = (xs: number[]) => valid(xs).reduce((a, b) => a + b, 0);

/** Series.mean(): NaN when there's nothing to average. */
export function mean(xs: number[]): number {
  const v = valid(xs);
  return v.length ? sum(v) / v.length : NaN;
}

/** Series.quantile(q) with pandas' default "linear" rule (blend the two neighbours). */
export function quantile(xs: number[], q: number): number {
  const v = valid(xs).sort((a, b) => a - b);
  if (!v.length) return NaN;
  const pos = (v.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return v[lo] + (v[hi] - v[lo]) * (pos - lo);
}

export const median = (xs: number[]) => quantile(xs, 0.5);
