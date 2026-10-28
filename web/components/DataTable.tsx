/** A simple table that scrolls sideways inside its card on narrow screens. */
import type { ReactNode } from "react";

export type Column<T> = {
  label: string;
  value: (row: T) => ReactNode;
  align?: "left" | "right";
};

export function DataTable<T>({ rows, columns, rowKey }: {
  rows: T[]; columns: Column<T>[]; rowKey: (row: T, i: number) => string;
}) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            {columns.map((c) => (
              <th key={c.label} scope="col" className={`px-3 py-2 font-medium first:pl-0 ${c.align === "right" ? "text-right" : ""}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={rowKey(r, i)} className="border-b border-line/70 last:border-0">
              {columns.map((c, j) => (
                <td key={c.label} className={`px-3 py-2 first:pl-0 ${c.align === "right" ? "text-right tabular-nums" : ""} ${j === 0 ? "font-medium text-ink" : "text-muted"}`}>
                  {c.value(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
