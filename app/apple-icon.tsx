import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0e9b6e' }}>
        <svg width="112" height="112" viewBox="0 0 24 24" fill="none">
          <path d="M20 12l-8 8-8-8 8-8h6a2 2 0 012 2v6z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="16" cy="8" r="1.5" fill="#fff" />
        </svg>
      </div>
    ),
    size
  )
}
