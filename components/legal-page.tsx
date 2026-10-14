import type { ReactNode } from 'react'
import { getContactEmail } from '@/lib/site'

export function LegalPage({ title, updatedAt, children }: { title: string; updatedAt: string; children: ReactNode }) {
  const email = getContactEmail()
  return (
    <div className="mx-auto max-w-3xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold text-slate-950">{title}</h1>
      <p className="mt-1 text-sm text-slate-500">Atualizado em {updatedAt}</p>
      <div className="mt-6 space-y-6 text-sm leading-6 text-slate-700 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-slate-900 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
        {children}
        <section>
          <h2>Contato</h2>
          <p>
            {email ? (
              <>
                Dúvidas ou pedidos sobre seus dados: <a className="font-medium text-brand-700 hover:underline" href={`mailto:${email}`}>{email}</a>.
              </>
            ) : (
              <>O canal de contato para dúvidas e pedidos sobre seus dados será publicado aqui em breve.</>
            )}
          </p>
        </section>
      </div>
    </div>
  )
}
