import { createServerClient } from '@/lib/supabase/server'
import { Flash, PageTitle } from '@/components/admin/flash'
import { SubmitButton } from '@/components/ui'
import { deleteMarketplace, saveMarketplace } from '@/app/admin/actions'

export default async function AdminMarketplacesPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const params = await searchParams
  const supabase = await createServerClient()
  const { data: marketplaces } = await supabase.from('marketplaces').select('*').order('name')

  return (
    <div className="space-y-5">
      <PageTitle
        title="Marketplaces"
        description="Domínios de afiliado: o sistema só aceita publicar links desses domínios para o marketplace (separe por vírgula)."
      />
      <Flash ok={params.ok} erro={params.erro} />

      <form action={saveMarketplace} className="grid gap-2 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_2fr_auto_auto]">
        <input name="name" required placeholder="Nome (ex.: Amazon)" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <input name="affiliate_hosts" placeholder="Domínios de afiliado (ex.: amazon.com.br, amzn.to)" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <label className="flex items-center gap-1 text-sm text-slate-700">
          <input type="checkbox" name="active" defaultChecked /> Ativo
        </label>
        <SubmitButton pendingText="Salvando…">Criar</SubmitButton>
      </form>

      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {(marketplaces ?? []).map((marketplace) => (
          <li key={marketplace.id} className="flex flex-wrap items-center gap-2 p-3">
            <form action={saveMarketplace} className="grid flex-1 gap-2 sm:grid-cols-[1fr_1fr_2fr_auto_auto]">
              <input type="hidden" name="id" value={marketplace.id} />
              <input name="name" defaultValue={marketplace.name} required aria-label="Nome" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
              <input name="slug" defaultValue={marketplace.slug} aria-label="Slug" className="rounded-md border border-slate-300 px-3 py-2 font-mono text-xs" />
              <input
                name="affiliate_hosts"
                defaultValue={marketplace.affiliate_hosts.join(', ')}
                aria-label="Domínios de afiliado"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <label className="flex items-center gap-1 text-sm text-slate-700">
                <input type="checkbox" name="active" defaultChecked={marketplace.active} /> Ativo
              </label>
              <SubmitButton variant="secondary" pendingText="…">Salvar</SubmitButton>
            </form>
            <form action={deleteMarketplace}>
              <input type="hidden" name="id" value={marketplace.id} />
              <SubmitButton variant="secondary" pendingText="…" className="text-red-700">Excluir</SubmitButton>
            </form>
          </li>
        ))}
      </ul>
    </div>
  )
}
