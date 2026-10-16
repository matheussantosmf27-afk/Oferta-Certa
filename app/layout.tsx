import './globals.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Script from 'next/script'
import { Instrument_Sans, Unbounded } from 'next/font/google'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { SITE_NAME, getSiteUrl } from '@/lib/site'

// Cabeçalho (categorias) e rodapé consultam o banco: toda página estática é renovada a cada 5 minutos.
export const revalidate = 300

// Unbounded (larga, geométrica) para marca, títulos e preços; Instrument Sans para leitura.
const display = Unbounded({ subsets: ['latin'], variable: '--font-display', weight: ['500', '700'] })
const body = Instrument_Sans({ subsets: ['latin'], variable: '--font-body' })

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: `${SITE_NAME} — ofertas e comparação de preços`, template: `%s | ${SITE_NAME}` },
  description: 'Ofertas selecionadas de grandes lojas, com preços atualizados e descontos reais.',
  // Verificação do Google Search Console (opcional): defina NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION na Vercel.
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
  openGraph: {
    siteName: SITE_NAME,
    type: 'website',
    locale: 'pt_BR',
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable}`}>
      <body className="font-sans">
        <SiteHeader />
        <main className="min-h-[70vh] bg-surface-100 text-slate-900">{children}</main>
        <SiteFooter />
        {/* Vercel Web Analytics: contagem de visitas agregada e sem cookies (só ativa em produção na Vercel). */}
        {process.env.VERCEL_ENV === 'production' ? (
          <>
            <Script id="va-queue" strategy="afterInteractive">
              {'window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };'}
            </Script>
            <Script src="/_vercel/insights/script.js" strategy="afterInteractive" />
          </>
        ) : null}
      </body>
    </html>
  )
}
