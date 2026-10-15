import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-surface-500 bg-white p-8 text-center text-slate-600">
      <p className="font-display text-base font-bold text-night">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
