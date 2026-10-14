import Link from 'next/link'
import { getActiveCoupons } from '@/services/catalog'

export async function SiteFooter() {
  // Só mostra Cupons quando houver algum ativo (evita levar a uma página vazia).
  const hasCoupons = (await getActiveCoupons()).length > 0
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-slate-600 sm:px-6 lg:px-8">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/categorias" className="hover:text-slate-900">Categorias</Link>
          <Link href="/ofertas" className="hover:text-slate-900">Ofertas</Link>
          {hasCoupons ? <Link href="/cupons" className="hover:text-slate-900">Cupons</Link> : null}
          <Link href="/favoritos" className="hover:text-slate-900">Favoritos</Link>
          <Link href="/minha-conta" className="hover:text-slate-900">Minha conta</Link>
          <Link href="/privacidade" className="hover:text-slate-900">Privacidade</Link>
          <Link href="/termos" className="hover:text-slate-900">Termos de uso</Link>
        </div>
        <p className="mt-4 max-w-3xl leading-6">
          O Oferta Certa não vende produtos. Mostramos ofertas de lojas parceiras e podemos receber uma comissão quando
          você compra por meio dos nossos links, sem custo adicional para você. Preços, estoque e frete podem mudar a
          qualquer momento — confira sempre na loja antes de finalizar a compra.
        </p>
        <p className="mt-3 text-xs text-slate-500">© {new Date().getFullYear()} Oferta Certa</p>
      </div>
    </footer>
  )
}
