'use client'

import Image from 'next/image'
import { useState } from 'react'

/** Foto principal com miniaturas clicáveis (fotos do catálogo do Mercado Livre). */
export function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const [active, setActive] = useState(0)
  if (!images.length) {
    return <div className="flex h-72 items-center justify-center text-slate-400">Sem imagem</div>
  }
  const current = images[Math.min(active, images.length - 1)]
  return (
    <div>
      <Image
        src={current}
        alt={alt}
        width={800}
        height={600}
        priority
        sizes="(min-width: 1024px) 50vw, 100vw"
        className="mx-auto max-h-[420px] w-full object-contain"
      />
      {images.length > 1 ? (
        <ul className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Fotos do produto">
          {images.map((src, index) => (
            <li key={src} className="shrink-0">
              <button
                type="button"
                onClick={() => setActive(index)}
                aria-label={`Ver foto ${index + 1} de ${images.length}`}
                aria-current={index === active}
                className={`flex h-16 w-16 items-center justify-center rounded-md border bg-white p-1 ${
                  index === active ? 'border-brand-600 ring-2 ring-brand-200' : 'border-slate-200 hover:border-slate-400'
                }`}
              >
                <Image src={src} alt="" width={64} height={64} className="max-h-full w-auto object-contain" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
