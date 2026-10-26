import { useState } from 'react'

type SafeImageProps = {
  src?: string | null
  alt?: string
  className?: string
  variant?: 'thumb' | 'display' | 'original'
  loading?: 'lazy' | 'eager'
}

function withVariant(src: string, variant: SafeImageProps['variant']) {
  if (!variant || variant === 'display' || !src.includes('/api/media/')) return src
  const joiner = src.includes('?') ? '&' : '?'
  return `${src}${joiner}variant=${encodeURIComponent(variant)}`
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
