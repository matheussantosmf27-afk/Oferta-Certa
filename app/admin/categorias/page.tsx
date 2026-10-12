import { createServerClient } from '@/lib/supabase/server'
import { Flash, PageTitle } from '@/components/admin/flash'
import { SubmitButton } from '@/components/ui'
import { deleteCategory, saveCategory } from '@/app/admin/actions'

export default async function AdminCategoriesPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string; q?: string }> }) {
  const params = await searchParams
  const supabase = await createServerClient()
  let query = supabase.from('categories').select('*').order('name')
  if (params.q) query = query.ilike('name', `%${params.q.replace(/[%_,()]/g, ' ').trim()}%`)
  const { data: categories } = await query

  return (
    <div className="space-y-5">
      <PageTitle title="Categorias" />
      <Flash ok={params.ok} erro={params.erro} />

      <form action={saveCategory} className="grid gap-2 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-[4rem_1fr_1fr_auto]">
        <input name="icon" placeholder="Ícone" maxLength={4} aria-label="Ícone" className="rounded-md border border-slate-300 px-2 py-2 text-sm" />
        <input name="name" required placeholder="Nome da nova categoria" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <input name="description" placeholder="Descrição (opcional)" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <SubmitButton pendingText="Salvando…">Criar</SubmitButton>
      </form>

      <form method="get" className="flex gap-2">
        <input name="q" defaultValue={params.q ?? ''} placeholder="Pesquisar categoria" className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <button className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm">Pesquisar</button>
      </form>

      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {(categories ?? []).map((category) => (
          <li key={category.id} className="flex flex-wrap items-center gap-2 p-3">
            <form action={saveCategory} className="grid flex-1 gap-2 sm:grid-cols-[4rem_1fr_1fr_1.5fr_auto]">
              <input type="hidden" name="id" value={category.id} />
              <input name="icon" defaultValue={category.icon ?? ''} maxLength={4} aria-label="Ícone" className="rounded-md border border-slate-300 px-2 py-2 text-sm" />
              <input name="name" defaultValue={category.name} required aria-label="Nome" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
              <input name="slug" defaultValue={category.slug} aria-label="Slug" className="rounded-md border border-slate-300 px-3 py-2 font-mono text-xs" />
              <input name="description" defaultValue={category.description ?? ''} aria-label="Descrição" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
              <SubmitButton variant="secondary" pendingText="…">Salvar</SubmitButton>
            </form>
            <form action={deleteCategory}>
              <input type="hidden" name="id" value={category.id} />
              <SubmitButton variant="secondary" pendingText="…" className="text-red-700">Excluir</SubmitButton>
            </form>
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-500">Categorias com produtos não podem ser excluídas; mova os produtos antes.</p>
    </div>
  )
}
