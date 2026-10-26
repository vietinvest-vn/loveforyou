import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'

type LegalDocumentPageProps = {
  title: string
  updatedAt: string
  onBack: () => void
  backLabel?: string
  children: ReactNode
}

export default function LegalDocumentPage({ title, updatedAt, onBack, backLabel = 'Quay lại Cài đặt', children }: LegalDocumentPageProps) {
  return <>
    <button type="button" className="core-secondary legal-back-button" onClick={onBack}><ArrowLeft size={16} /> {backLabel}</button>
    <article className="legal-document" aria-label={title}>
      <p className="core-eyebrow">LOVEFORYOU · TÀI LIỆU</p>
      <h2>{title}</h2>
      <p className="legal-updated">Cập nhật lần cuối: {updatedAt}</p>
      <div className="legal-document-content">{children}</div>
    </article>
  </>
}