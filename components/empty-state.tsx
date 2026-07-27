interface EmptyStateProps {
  title: string
  description: string
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600 shadow-sm">
      <p className="text-lg font-semibold text-slate-950">{title}</p>
      <p className="mt-3 text-sm leading-6">{description}</p>
    </div>
  )
}
