import type { ReactNode } from 'react'

export function AuthCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-10 sm:py-16">
      <div className="rounded-xl border border-surface-300 bg-white p-6 shadow-soft sm:p-8">
        <h1 className="font-display text-2xl font-bold tracking-tight text-night">{title}</h1>
        {description ? <p className="mt-2 text-sm text-slate-600">{description}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}
