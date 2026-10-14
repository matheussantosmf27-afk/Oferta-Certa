import { notFound } from 'next/navigation'
import { getArticleBySlug } from '@/services/catalog'

// Página pública em cache, renovada a cada 5 minutos (preços mudam a cada coleta).
export const revalidate = 300

// Gera cada página na primeira visita e mantém em cache.
export async function generateStaticParams() {
  return []
}

export default async function ArticlePage(props: { params: Promise<{ slug: string }> }) {
  const { params } = props
  const { slug } = await params
  const article = await getArticleBySlug(slug)
  if (!article) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-10 pt-8 sm:px-6 lg:px-8">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-soft">
        <div className="space-y-4">
          <div className="text-sm uppercase tracking-[0.35em] text-brand-700">{article.category}</div>
          <h1 className="text-4xl font-semibold text-slate-950">{article.title}</h1>
          <p className="text-sm text-slate-500">Publicado em {new Date(article.published_at).toLocaleDateString('pt-BR')}</p>
          <p className="text-base leading-7 text-slate-600">{article.summary}</p>
        </div>
      </div>
      <article className="prose prose-slate mt-10 max-w-none rounded-[2rem] border border-slate-200 bg-white p-8 shadow-card">
        <div>{article.content}</div>
      </article>
    </div>
  )
}
