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
        <h2 className="text-xl font-semibold text-slate-950 sm:text-2xl">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>
      {href ? (
        <Link href={href} className="shrink-0 text-sm font-medium text-brand-700 hover:underline">
          {linkLabel}
        </Link>
      ) : null}
    </div>
  )
}
