import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-4xl flex-col items-center justify-center gap-6 px-4 text-center sm:px-6">
      <p className="text-sm uppercase tracking-[0.35em] text-brand-700">Página não encontrada</p>
      <h1 className="text-4xl font-semibold text-slate-950">404 — Ops, a oferta não está aqui</h1>
      <p className="max-w-xl text-sm leading-6 text-slate-600">A oferta que você procura foi removida ou nunca existiu. Volte para a home e continue a descoberta.</p>
      <Link href="/" className="inline-flex rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700">
        Voltar para o início
      </Link>
    </div>
  )
}
