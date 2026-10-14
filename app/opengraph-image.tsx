import { ImageResponse } from 'next/og'

export const alt = 'Oferta Certa — ofertas reais, preços conferidos'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/** Imagem padrão ao compartilhar o site (produtos usam a foto do próprio produto). */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: '#0b7d56',
          color: '#fff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ width: 96, height: 96, borderRadius: 20, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none">
              <path d="M20 12l-8 8-8-8 8-8h6a2 2 0 012 2v6z" stroke="#0b7d56" strokeWidth="2" strokeLinejoin="round" />
              <circle cx="16" cy="8" r="1.6" fill="#0b7d56" />
            </svg>
          </div>
          <div style={{ fontSize: 52, fontWeight: 700 }}>Oferta Certa</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, maxWidth: 950 }}>Ofertas reais, preços conferidos.</div>
          <div style={{ fontSize: 34, color: '#dff7ef', maxWidth: 950 }}>
            Descontos só quando existem de verdade, nas maiores lojas do Brasil.
          </div>
        </div>
      </div>
    ),
    size
  )
}
