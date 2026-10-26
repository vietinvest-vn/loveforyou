import { useState } from 'react'
import { apiUrl } from '../apiClient'

type SafeImageProps = {
  src?: string | null
  alt?: string
  className?: string
  variant?: 'thumb' | 'display' | 'original'
  loading?: 'lazy' | 'eager'
}

function withVariant(src: string, variant: SafeImageProps['variant']) {
  if (!src.includes('/api/media/')) return src
  const imageUrl = !variant || variant === 'display'
    ? src
    : `${src}${src.includes('?') ? '&' : '?'}variant=${encodeURIComponent(variant)}`
  return apiUrl(imageUrl)
}

export default function SafeImage({
  src,
  alt = '',
  className,
  variant = 'display',
  loading = 'lazy',
}: SafeImageProps) {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  if (!src || failed) {
    return <span className={`safe-image-fallback ${className ?? ''}`.trim()} role="img" aria-label={alt || 'Ảnh không khả dụng'}>Không tải được ảnh</span>
  }
  return (
    <span className={`safe-image ${loaded ? 'is-loaded' : 'is-loading'} ${className ?? ''}`.trim()}>
      {!loaded && <span className="safe-image-skeleton" aria-hidden="true" />}
      <img
        src={withVariant(src, variant)}
        alt={alt}
        loading={loading}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </span>
  )
}
