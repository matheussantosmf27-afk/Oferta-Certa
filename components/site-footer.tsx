import Link from 'next/link'
import { getActiveCoupons } from '@/services/catalog'
import { LogoMark } from '@/components/logo'

export async function SiteFooter() {
  // Só mostra Cupons quando houver algum ativo (evita levar a uma página vazia).
  const hasCoupons = (await getActiveCoupons()).length > 0
  const links = [
    { href: '/ofertas', label: 'Ofertas do dia' },
    { href: '/categorias', label: 'Categorias' },
    ...(hasCoupons ? [{ href: '/cupons', label: 'Cupons' }] : []),
    { href: '/favoritos', label: 'Favoritos' },
    { href: '/minha-conta', label: 'Minha conta' },
    { href: '/privacidade', label: 'Privacidade' },
    { href: '/termos', label: 'Termos de uso' },
  ]

  return (
    <footer className="bg-night text-white/70">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 text-sm sm:px-6 md:grid-cols-[1fr_1.4fr] lg:px-8">
        <div>
          <div className="flex items-center gap-2.5 text-white">
            <LogoMark />
            <span className="font-display text-base font-bold tracking-tight">Oferta Certa</span>
          </div>
          <p className="mt-4 max-w-sm leading-6">
            O Oferta Certa não vende produtos. Mostramos ofertas de lojas parceiras e podemos receber uma comissão quando você compra pelos
            nossos links, sem custo adicional para você.
          </p>
        </div>
        <div>
          <nav aria-label="Rodapé" className="grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-3">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-white">
                {link.label}
              </Link>
            ))}
          </nav>
          <p className="mt-6 max-w-xl text-xs leading-5 text-white/50">
            Preços, estoque e frete podem mudar a qualquer momento. Confira sempre na loja antes de finalizar a compra.
          </p>
          <p className="mt-3 text-xs text-white/40">© {new Date().getFullYear()} Oferta Certa</p>
        </div>
      </div>
    </footer>
  )
}
