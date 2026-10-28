/** A bag-shaped monogram plus the name. */
export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <rect width="32" height="32" rx="9" fill="#1f4d3a" />
        <path d="M11 13v-1.5a5 5 0 0 1 10 0V13" fill="none" stroke="#f4e8d0" strokeWidth="2" strokeLinecap="round" />
        <rect x="7.5" y="13" width="17" height="11.5" rx="3" fill="#f4e8d0" />
        <circle cx="16" cy="18.5" r="1.6" fill="#a87b2f" />
      </svg>
      <span className="leading-tight">
        <span className="block font-display text-[1.05rem] font-semibold text-ink">Resale Analytics</span>
        <span className="block text-[0.7rem] font-medium tracking-wide text-faint">TOKYO → LONDON</span>
      </span>
    </span>
  );
}
