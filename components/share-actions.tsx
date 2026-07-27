'use client'

import { Copy, Share2 } from 'lucide-react'
import { useState } from 'react'

interface ShareActionsProps {
  url: string
}

export function ShareActions({ url }: ShareActionsProps) {
  const [copied, setCopied] = useState(false)

  const copyUrl = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  const share = async () => {
    if (navigator.share) {
      await navigator.share({ title: 'Oferta Certa', text: 'Confira esta oferta', url })
    } else {
      await copyUrl()
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={share}
        className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
      >
        <Share2 className="h-4 w-4" /> Compartilhar
      </button>
      <button
        type="button"
        onClick={copyUrl}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        <Copy className="h-4 w-4" /> {copied ? 'Copiado!' : 'Copiar link'}
      </button>
    </div>
  )
}
