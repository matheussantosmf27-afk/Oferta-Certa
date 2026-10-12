import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
      <p className="text-base font-semibold text-slate-950">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
