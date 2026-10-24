import { useId } from 'react'

// Marca de AURA: un halo (el "aura") que dibuja una A, con una chispa en el centro.
export function LogoMark({ size = 36, className = '' }: { size?: number; className?: string }) {
  const id = useId()
  const fill = `${id}-fill`
  const sheen = `${id}-sheen`
  return (
    <svg className={`logo-mark ${className}`.trim()} width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="AURA" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={fill} x1="6" y1="2" x2="44" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4f46e5" />
          <stop offset=".55" stopColor="#7c5cf0" />
          <stop offset="1" stopColor="#b86cf5" />
        </linearGradient>
        <radialGradient id={sheen} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(14 8) rotate(50) scale(40)">
          <stop offset="0" stopColor="#fff" stopOpacity=".32" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill={`url(#${fill})`} />
      <rect width="48" height="48" rx="14" fill={`url(#${sheen})`} />
      <path d="M13.5 35.5C13.5 21 18 11.5 24 11.5S34.5 21 34.5 35.5" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" fill="none" />
      <path d="M24 20.5l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#fff" />
    </svg>
  )
}

export function Logo({ compact = false, tagline = 'Autonomous Unified Routine Assistant' }: { compact?: boolean; tagline?: string }) {
  return (
    <div className="brand">
      <LogoMark size={compact ? 32 : 38} />
      <span className="brand-copy">
        <strong>AURA</strong>
        {!compact && <small>{tagline}</small>}
      </span>
    </div>
  )
}
