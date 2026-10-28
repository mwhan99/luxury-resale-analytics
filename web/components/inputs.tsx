"use client";

/** Form controls for the calculators. Every input is a real, labelled <input>. */
import { useId, useState } from "react";

/** A number box that lets you type freely and only reports valid numbers. */
export function NumberField({ label, value, onChange, step = 1, min = 0, prefix = "£", hint }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; prefix?: string; hint?: string;
}) {
  const id = useId();
  const [text, setText] = useState(String(value));
  const [last, setLast] = useState(value);
  // When the value changes from outside (new data, a reset), show it.
  if (value !== last) {
    setLast(value);
    if (Number(text) !== value) setText(String(value));
  }
  return (
    <label htmlFor={id} className="block">
      <span className="text-sm font-medium text-ink">{label}</span>
      <span className="mt-1 flex items-center rounded-xl border border-line bg-white focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15">
        {prefix && <span className="pl-3 text-sm text-faint">{prefix}</span>}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const n = Number(e.target.value);
            if (e.target.value !== "" && isFinite(n) && n >= min) {
              setLast(n);
              onChange(n);
            }
          }}
          className="w-full min-w-0 rounded-xl bg-transparent px-3 py-2 text-ink tabular-nums outline-none"
        />
      </span>
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  );
}

/** A percentage slider. `value` is a fraction (0.25 = 25%). */
export function PercentSlider({ label, value, onChange, min = 0, max = 100, step = 5, hint }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; hint?: string;
}) {
  const id = useId();
  const shown = Math.round(value * 100);
  return (
    <div>
      <label htmlFor={id} className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium text-ink">{label}</span>
        <span className="font-semibold tabular-nums text-brand">{shown}%</span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={shown}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="mt-2 w-full"
      />
      {hint && <p className="text-xs text-faint">{hint}</p>}
    </div>
  );
}

export function Toggle({ label, checked, onChange, disabled, hint }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; hint?: string;
}) {
  const id = useId();
  return (
    <div className={disabled ? "opacity-50" : ""}>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-sm">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span aria-hidden className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-line transition peer-checked:bg-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand/30 after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-4" />
        <span>
          <span className="font-medium text-ink">{label}</span>
          {hint && <span className="mt-0.5 block text-xs text-faint">{hint}</span>}
        </span>
      </label>
    </div>
  );
}

/** A row of buttons where exactly one is chosen. */
export function Segmented<T extends string>({ label, options, value, onChange }: {
  label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-xl bg-sand p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            value === o.value ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Select({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="block">
      <span className="text-sm font-medium text-ink">{label}</span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
      >
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </label>
  );
}
