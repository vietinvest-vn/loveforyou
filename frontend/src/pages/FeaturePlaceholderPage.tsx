import { Clock3, Gift, LockKeyhole, Sparkles, Wallet } from 'lucide-react'
import type { Page } from '../routing'

type FeaturePlaceholderPageProps = {
  page: Page
  title: string
  description: string
}

export default function FeaturePlaceholderPage({ page, title, description }: FeaturePlaceholderPageProps) {
  const Icon = page === 'wallet' ? Wallet : page === 'events' ? Clock3 : page === 'gifts' ? Gift : page === 'privacy' ? LockKeyhole : Sparkles
  return <section className="development-page core-panel">
    <span className="development-page-icon"><Icon size={27} /></span>
    <span className="development-pill">Đang phát triển</span>
    <h2>{title}</h2>
    <p>{description}</p>
  </section>
}