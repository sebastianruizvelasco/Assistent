import { LogoMark } from './Logo'

export function LoadingScreen({ title }: { title: string }) {
  return (
    <div className="auth-screen">
      <div className="auth-panel loading-panel">
        <LogoMark size={56} className="logo-pulse" />
        <p className="eyebrow">AURA</p>
        <h1>{title}</h1>
      </div>
    </div>
  )
}
