import Link from 'next/link'

interface SectionHeadingProps {
  title: string
  description?: string
  href?: string
  linkLabel?: string
}

export function SectionHeading({ title, description, href, linkLabel = 'Ver tudo' }: SectionHeadingProps) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-night sm:text-2xl">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>
      {href ? (
        <Link href={href} className="shrink-0 rounded-md border border-surface-300 bg-white px-3 py-1.5 text-sm font-medium text-brand-700 hover:border-brand-500">
          {linkLabel}
        </Link>
      ) : null}
    </div>
  )
}
