interface SectionHeadingProps {
  title: string
  description?: string
}

export function SectionHeading({ title, description }: SectionHeadingProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="inline-flex items-center rounded-sm bg-brand-100 px-3 py-1 text-sm font-semibold text-brand-700">
        Destaques
      </div>
      <div>
        <h2 className="text-2xl font-semibold text-slate-950">{title}</h2>
        {description ? <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p> : null}
      </div>
    </div>
  )
}
