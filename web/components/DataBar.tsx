"use client";

/**
 * The strip at the top of every tool page: which data is in use, and the
 * upload button. The spreadsheet is read by the visitor's own browser; it is
 * never sent anywhere.
 */
import { useRef, useState } from "react";

import { readTracker } from "@/lib/read-xlsx";
import { SMALL_SAMPLE } from "@/lib/tracker";
import { useTracker } from "./TrackerProvider";

export function DataBar() {
  const t = useTracker();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lots = new Set(t.bags.map((b) => b.lot)).size;

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted">
          <span className={`mr-2 inline-block size-2 rounded-full align-middle ${t.fileName ? "bg-brass" : "bg-brand"}`} aria-hidden />
          {t.fileName ? (
            <>Using <span className="font-semibold text-ink">your file, {t.fileName}</span>. It stays in this browser tab and is never uploaded.</>
          ) : (
            <>Using <span className="font-semibold text-ink">demo data</span>: real shipments, disguised.</>
          )}{" "}
          <span className="text-faint">{t.bags.length} bags · {lots} lot(s)</span>
        </p>
        <div className="flex shrink-0 gap-2">
          {t.fileName && (
            <button type="button" onClick={() => { t.loadDemo(); setError(null); }} className="rounded-full px-3 py-1.5 font-medium text-muted hover:bg-sand hover:text-ink">
              Back to demo
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            className="rounded-full border border-brand px-3 py-1.5 font-semibold text-brand hover:bg-brand hover:text-white disabled:opacity-60"
          >
            {busy ? "Reading…" : "Open a tracker (.xlsx)"}
          </button>
          <input
            ref={input}
            type="file"
            accept=".xlsx"
            className="sr-only"
            aria-label="Open a tracker spreadsheet"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setBusy(true);
              setError(null);
              try {
                t.loadFile(await readTracker(await file.arrayBuffer()), file.name);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Couldn't read that file.");
              } finally {
                setBusy(false);
              }
            }}
          />
        </div>
      </div>
      {!t.fileName && (
        <p className="px-1 text-xs text-faint">
          Want to see the upload work? Download the <a href="/demo_tracker.xlsx" download className="font-medium text-brand hover:underline">demo tracker</a>,
          change a number, and open it here.
        </p>
      )}
      {error && <p role="alert" className="rounded-xl bg-loss-soft px-4 py-2 text-sm text-loss">Couldn&apos;t read the tracker: {error}</p>}
      {t.bags.length < SMALL_SAMPLE && t.bags.length > 0 && (
        <p className="text-xs text-faint">Small sample: {t.bags.length} bags. Treat results as early patterns to test, not proven conclusions.</p>
      )}
    </div>
  );
}
