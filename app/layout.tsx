import './globals.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Inter } from 'next/font/google'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { SITE_NAME, getSiteUrl } from '@/lib/site'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: `${SITE_NAME} — ofertas e comparação de preços`, template: `%s | ${SITE_NAME}` },
  description: 'Ofertas selecionadas de grandes lojas, com preços atualizados e descontos reais.',
  openGraph: {
    siteName: SITE_NAME,
    type: 'website',
    locale: 'pt_BR',
  },
  alternates: { canonical: '/' },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <SiteHeader />
        <main className="min-h-[70vh] bg-surface-50 text-slate-900">{children}</main>
        <SiteFooter />
      </body>
    </html>
  )
}
