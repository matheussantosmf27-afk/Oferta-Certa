import Link from 'next/link'

/** Marca: um radar com o feixe de varredura e um sinal (a oferta encontrada). */
export function LogoMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <rect width="40" height="40" rx="11" fill="#2340ff" />
      <circle cx="20" cy="20" r="12.5" fill="none" stroke="#7cf4ff" strokeOpacity="0.35" strokeWidth="1.5" />
      <circle cx="20" cy="20" r="6.5" fill="none" stroke="#7cf4ff" strokeOpacity="0.35" strokeWidth="1.5" />
      <path d="M20 20 L20 7.5 A12.5 12.5 0 0 1 31.6 15.3 Z" fill="#7cf4ff" fillOpacity="0.85" />
      <circle cx="27.2" cy="25.6" r="2.6" fill="#ff4f5e" />
      <circle cx="20" cy="20" r="1.8" fill="#ffffff" />
    </svg>
  )
}

export function Logo({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Oferta Certa — início">
      <LogoMark />
      <span className={`hidden font-display text-[1.05rem] font-bold leading-none tracking-tight sm:inline ${tone === 'light' ? 'text-white' : 'text-night'}`}>
        Oferta Certa
      </span>
    </Link>
  )
}
