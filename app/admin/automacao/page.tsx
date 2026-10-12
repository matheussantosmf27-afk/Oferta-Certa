import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { Flash, PageTitle } from '@/components/admin/flash'
import { SubmitButton } from '@/components/ui'
import { disableAutoPublish, saveAutomationSettings, unpublishRun, validateAffiliateLink } from '@/app/admin/actions'

const fmt = (value: string | null) =>
  value ? new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }) : '—'

export default async function AutomationPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const params = await searchParams
  const supabase = await createServerClient()
  const [{ data: settings, error }, { data: runs }] = await Promise.all([
    supabase.from('automation_settings').select('*').maybeSingle(),
    supabase
      .from('radar_runs')
      .select('id, trigger, status, started_at, upserted_count, auto_published_count, refreshed_count, expired_count, message')
      .order('started_at', { ascending: false })
      .limit(15),
  ])

  const tagReady = Boolean(settings?.ml_matt_word && settings?.ml_matt_tool)

  return (
    <div className="space-y-6">
      <PageTitle
        title="Publicação automática"
        description="Candidatos do Radar com pontuação acima do mínimo vão para o site com o seu link de afiliado, sem revisão manual."
      >
        {settings?.auto_publish_enabled ? (
          <form action={disableAutoPublish}>
            <SubmitButton variant="secondary" pendingText="Desligando…" className="text-red-700">
              Desligar agora
            </SubmitButton>
          </form>
        ) : null}
      </PageTitle>
      <Flash ok={params.ok} erro={params.erro ?? error?.message} />

      <div
        className={`rounded-lg border p-4 text-sm ${settings?.auto_publish_enabled ? 'border-brand-200 bg-brand-50 text-brand-900' : 'border-slate-200 bg-white text-slate-700'}`}
      >
        Situação: <strong>{settings?.auto_publish_enabled ? 'LIGADA' : 'desligada'}</strong>
        {' · '}Etiqueta de afiliado: <strong>{tagReady ? 'configurada' : 'não configurada'}</strong>
        {!tagReady ? (
          <p className="mt-1 text-slate-600">Valide primeiro um link de afiliado real (abaixo). Sem etiqueta, nada é publicado automaticamente.</p>
        ) : null}
      </div>

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">1. Validar o link de afiliado</h2>
        <p className="text-sm text-slate-600">
          No portal de afiliados do Mercado Livre, gere o <strong>link completo</strong> (não o encurtado) de um produto e cole aqui. O link só é
          aceito se for a página do produto com <code>matt_word</code> e <code>matt_tool</code> e se o sistema conseguir reproduzi-lo exatamente.
          Links <code>meli.la</code> ou <code>/sec/</code> não servem para automação.
        </p>
        <form action={validateAffiliateLink} className="flex flex-wrap gap-2">
          <input
            name="affiliate_link"
            type="url"
            required
            placeholder="https://www.mercadolivre.com.br/p/MLB...?matt_word=...&matt_tool=..."
            className="min-w-[16rem] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <SubmitButton variant="secondary" pendingText="Analisando…">
            Validar link
          </SubmitButton>
        </form>
      </section>

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">2. Regras</h2>
        <form action={saveAutomationSettings} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm">
            <span className="block font-medium text-slate-700">Pontuação mínima (publica se maior que)</span>
            <input
              name="auto_publish_min_score"
              type="number"
              min={0}
              max={100}
              step="0.1"
              defaultValue={settings?.auto_publish_min_score ?? 40}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="block font-medium text-slate-700">Máximo por coleta</span>
            <input
              name="auto_publish_max_per_run"
              type="number"
              min={0}
              max={200}
              defaultValue={settings?.auto_publish_max_per_run ?? 20}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="block font-medium text-slate-700">Máximo por dia</span>
            <input
              name="auto_publish_max_per_day"
              type="number"
              min={0}
              max={1000}
              defaultValue={settings?.auto_publish_max_per_day ?? 100}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <div />
          <label className="text-sm">
            <span className="block font-medium text-slate-700">matt_word (etiqueta)</span>
            <input name="ml_matt_word" defaultValue={settings?.ml_matt_word ?? ''} maxLength={64} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="block font-medium text-slate-700">matt_tool</span>
            <input name="ml_matt_tool" defaultValue={settings?.ml_matt_tool ?? ''} maxLength={64} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-800 sm:col-span-2">
            <input type="checkbox" name="auto_publish_enabled" defaultChecked={settings?.auto_publish_enabled ?? false} disabled={!tagReady} />
            Ligar publicação automática {!tagReady ? '(valide a etiqueta primeiro)' : ''}
          </label>
          <div className="sm:col-span-2 lg:col-span-4">
            <SubmitButton pendingText="Salvando…">Salvar regras</SubmitButton>
          </div>
        </form>
        <p className="text-xs text-slate-500">
          Só entram candidatos pendentes, com imagem, preço, categoria, vendedor confirmado na mesma coleta e sem desconto suspeito. Produto que já
          existe no catálogo nunca é sobrescrito. Produtos sem vendedor em duas coletas seguidas ficam inativos sozinhos.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-slate-950">Últimas coletas</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">Início</th>
                <th className="p-3">Status</th>
                <th className="p-3">Candidatos</th>
                <th className="p-3">Publicados auto.</th>
                <th className="p-3">Inativados</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {(runs ?? []).map((run) => (
                <tr key={run.id} className="border-t border-slate-100 align-top">
                  <td className="p-3 text-slate-700">
                    {fmt(run.started_at)}
                    <p className="text-xs text-slate-400">{run.trigger === 'schedule' ? 'agendada' : 'manual'}</p>
                  </td>
                  <td className="p-3">
                    {run.status}
                    {run.message ? <p className="max-w-xs text-xs text-slate-500">{run.message}</p> : null}
                  </td>
                  <td className="p-3">{run.upserted_count}</td>
                  <td className="p-3">
                    {run.auto_published_count ? (
                      <Link href={`/admin/produtos?modo=auto&execucao=${run.id}`} className="text-brand-700 hover:underline">
                        {run.auto_published_count}
                      </Link>
                    ) : (
                      0
                    )}
                  </td>
                  <td className="p-3">{run.expired_count}</td>
                  <td className="p-3">
                    {run.auto_published_count ? (
                      <form action={unpublishRun}>
                        <input type="hidden" name="run_id" value={run.id} />
                        <SubmitButton variant="secondary" pendingText="…" className="text-red-700">
                          Despublicar desta coleta
                        </SubmitButton>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
