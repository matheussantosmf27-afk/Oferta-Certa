import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#2340ff' }}>
        <svg width="140" height="140" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="12.5" fill="none" stroke="#7cf4ff" strokeOpacity="0.35" strokeWidth="1.5" />
          <circle cx="20" cy="20" r="6.5" fill="none" stroke="#7cf4ff" strokeOpacity="0.35" strokeWidth="1.5" />
          <path d="M20 20 L20 7.5 A12.5 12.5 0 0 1 31.6 15.3 Z" fill="#7cf4ff" fillOpacity="0.85" />
          <circle cx="27.2" cy="25.6" r="2.6" fill="#ff4f5e" />
          <circle cx="20" cy="20" r="1.8" fill="#ffffff" />
        </svg>
      </div>
    ),
    size
  )
}
