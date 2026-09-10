import Link from 'next/link';
export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="ერთად — მთავარი გვერდი">
      <span className="brand-icon">
        <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path
            d="M6 23V13a7 7 0 0 1 14 0v10M12 23V13a7 7 0 0 1 14 0v10"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M6 23h20"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span>
        ერთად<span className="brand-dot">.</span>
      </span>
    </Link>
  );
}
