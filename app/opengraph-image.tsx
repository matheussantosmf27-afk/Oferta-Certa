import { ImageResponse } from 'next/og'

export const alt = 'Oferta Certa — o radar que encontra o preço certo'
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
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '72px 80px',
          background: '#0b1640',
          backgroundImage:
            'linear-gradient(rgba(124,244,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(124,244,255,0.07) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          color: '#fff',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 640 }}>
          <div style={{ fontSize: 40, fontWeight: 700, color: '#7cf4ff' }}>Oferta Certa</div>
          <div style={{ fontSize: 78, fontWeight: 700, lineHeight: 1.04 }}>O radar que encontra o preço certo.</div>
          <div style={{ fontSize: 30, color: 'rgba(255,255,255,0.72)' }}>Desconto só quando existe de verdade.</div>
        </div>
        <svg width="380" height="380" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="19" fill="#172766" />
          <circle cx="20" cy="20" r="19" fill="none" stroke="#7cf4ff" strokeOpacity="0.4" strokeWidth="0.4" />
          <circle cx="20" cy="20" r="12.5" fill="none" stroke="#7cf4ff" strokeOpacity="0.3" strokeWidth="0.4" />
          <circle cx="20" cy="20" r="6.5" fill="none" stroke="#7cf4ff" strokeOpacity="0.3" strokeWidth="0.4" />
          <path d="M20 20 L20 1 A19 19 0 0 1 36.5 10.5 Z" fill="#7cf4ff" fillOpacity="0.55" />
          <circle cx="29" cy="27" r="1.6" fill="#ff4f5e" />
          <circle cx="11" cy="14" r="1.1" fill="#ff4f5e" />
          <circle cx="15" cy="29" r="0.9" fill="#ff4f5e" />
          <circle cx="20" cy="20" r="1" fill="#fff" />
        </svg>
      </div>
    ),
    size
  )
}
