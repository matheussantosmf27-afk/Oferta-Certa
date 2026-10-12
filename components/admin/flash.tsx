import type { ReactNode } from 'react'

export function Flash({ ok, erro }: { ok?: string; erro?: string }) {
  if (!ok && !erro) return null
  return (
    <p
      role={erro ? 'alert' : 'status'}
      className={erro ? 'rounded-md bg-red-50 px-4 py-3 text-sm text-red-700' : 'rounded-md bg-brand-50 px-4 py-3 text-sm text-brand-800'}
    >
      {erro ?? ok}
    </p>
  )
}

export function PageTitle({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>
      {children}
    </div>
  )
}
