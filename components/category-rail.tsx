'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react'

interface RailCategory {
  id: string
  slug: string
  name: string
}

const chipBase =
  'inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scan/70'
const chipIdle = 'border border-white/10 bg-white/[0.04] text-white/75 hover:border-white/25 hover:bg-white/10 hover:text-white'
const chipActive = 'border border-white bg-white text-night shadow-[0_0_0_3px_rgba(124,244,255,0.18)]'

/**
 * Trilho de categorias do cabeçalho: chips com rolagem horizontal sem barra visível,
 * esmaecimento nas bordas e setas que só aparecem quando há mais conteúdo daquele lado.
 */
export function CategoryRail({ categories }: { categories: RailCategory[] }) {
  const pathname = usePathname()
  const scroller = useRef<HTMLUListElement>(null)
  const [edges, setEdges] = useState({ start: false, end: false })

  const measure = useCallback(() => {
    const el = scroller.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setEdges({ start: el.scrollLeft > 4, end: el.scrollLeft < max - 4 })
  }, [])

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    // Leva a categoria aberta para a área visível.
    const active = el.querySelector<HTMLElement>('[aria-current="page"]')
    if (active) {
      const offset = active.offsetLeft - (el.clientWidth - active.offsetWidth) / 2
      el.scrollTo({ left: Math.max(0, offset) })
    }
    measure()
    el.addEventListener('scroll', measure, { passive: true })
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => {
      el.removeEventListener('scroll', measure)
      observer.disconnect()
    }
  }, [measure, pathname])

  const scrollBy = (direction: 1 | -1) => {
    const el = scroller.current
    if (!el) return
    el.scrollBy({ left: direction * el.clientWidth * 0.7, behavior: 'smooth' })
  }

  const isActive = (href: string) => pathname === href || pathname?.startsWith(`${href}/`)

  const mask = `linear-gradient(to right, ${edges.start ? 'transparent 0, #000 56px' : '#000 0'}, ${
    edges.end ? '#000 calc(100% - 56px), transparent 100%' : '#000 100%'
  })`

  return (
    <nav aria-label="Categorias" className="relative mt-3 border-t border-white/[0.06]">
      <ul
        ref={scroller}
        className="no-scrollbar flex snap-x scroll-px-4 items-center gap-2 overflow-x-auto overscroll-x-contain py-3"
        style={{ maskImage: mask, WebkitMaskImage: mask }}
      >
        <li className="snap-start">
          <Link
            href="/ofertas"
            aria-current={isActive('/ofertas') ? 'page' : undefined}
            className={`${chipBase} ${isActive('/ofertas') ? chipActive : 'border border-signal/40 bg-signal/10 text-white hover:border-signal/70 hover:bg-signal/20'}`}
          >
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-signal" />
            </span>
            Ofertas do dia
          </Link>
        </li>
        {categories.map((category) => {
          const href = `/categoria/${category.slug}`
          const active = isActive(href)
          return (
            <li key={category.id} className="snap-start">
              <Link href={href} aria-current={active ? 'page' : undefined} className={`${chipBase} ${active ? chipActive : chipIdle}`}>
                {category.name}
              </Link>
            </li>
          )
        })}
        <li className="snap-start pr-1">
          <Link
            href="/categorias"
            aria-current={pathname === '/categorias' ? 'page' : undefined}
            className={`${chipBase} ${pathname === '/categorias' ? chipActive : 'text-scan/90 hover:bg-white/10 hover:text-scan'}`}
          >
            <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
            Todas
          </Link>
        </li>
      </ul>

      <RailArrow side="left" visible={edges.start} onClick={() => scrollBy(-1)} />
      <RailArrow side="right" visible={edges.end} onClick={() => scrollBy(1)} />
    </nav>
  )
}

function RailArrow({ side, visible, onClick }: { side: 'left' | 'right'; visible: boolean; onClick: () => void }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onClick={onClick}
      tabIndex={-1}
      aria-hidden
      className={`absolute top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-night-800/90 text-white shadow-lg shadow-black/30 backdrop-blur transition-all duration-200 hover:border-scan/60 hover:text-scan sm:flex ${
        side === 'left' ? 'left-0' : 'right-0'
      } ${visible ? 'opacity-100' : 'pointer-events-none scale-90 opacity-0'}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}
