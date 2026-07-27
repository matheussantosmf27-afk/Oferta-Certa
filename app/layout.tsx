import './globals.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Inter } from 'next/font/google'
import { SiteHeader } from '@/components/site-header'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Oferta Certa',
  description: 'As melhores ofertas da internet, em um só lugar.',
  metadataBase: new URL('https://ofertacerta.com'),
  openGraph: {
    title: 'Oferta Certa',
    description: 'Descubra ofertas, cupons e produtos com confiança.',
    url: 'https://ofertacerta.com',
    siteName: 'Oferta Certa',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <SiteHeader />
        <main className="min-h-screen bg-surface-50 text-slate-900">{children}</main>
      </body>
    </html>
  )
}
