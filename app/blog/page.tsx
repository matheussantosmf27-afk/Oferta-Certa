import Link from 'next/link'
import { SectionHeading } from '@/components/section-heading'
import { getArticles } from '@/services/data'
import { EmptyState } from '@/components/empty-state'

export default function BlogPage() {
  const articles = getArticles()

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6 lg:px-8">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft sm:p-10">
        <SectionHeading title="Blog" description="Conteúdo para ajudar você a escolher as melhores ofertas." />
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {articles.length ? (
          articles.map((article) => (
            <article key={article.id} className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-card transition hover:-translate-y-1 hover:shadow-xl">
              <div className="space-y-3">
                <p className="text-sm uppercase tracking-[0.35em] text-brand-700">{article.category}</p>
                <h2 className="text-xl font-semibold text-slate-950">{article.title}</h2>
                <p className="text-sm leading-6 text-slate-600">{article.summary}</p>
                <Link href={`/blog/${article.slug}`} className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700">
                  Ler artigo →
                </Link>
              </div>
            </article>
          ))
        ) : (
          <EmptyState title="Blog em construção" description="Em breve teremos conteúdo para te ajudar a economizar." />
        )}
      </div>
    </div>
  )
}
