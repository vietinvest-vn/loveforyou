export async function optimizeImage(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && !file.type.startsWith('image/')) {
    throw new Error('Chọn một tệp ảnh JPEG, PNG hoặc WebP hợp lệ.')
  }
  if (file.size > 12 * 1024 * 1024) throw new Error('Ảnh cần nhỏ hơn 12 MB trước khi tối ưu.')
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Không thể đọc ảnh này. Hãy thử một ảnh JPG, PNG hoặc WebP khác.'))
    })
    image.src = objectUrl
    await loaded
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Không thể xử lý ảnh trên thiết bị này.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const mime = file.type === 'image/png' ? 'image/png' : file.type === 'image/webp' ? 'image/webp' : 'image/jpeg'
    const quality = mime === 'image/jpeg' ? 0.82 : 0.9
    return canvas.toDataURL(mime, quality)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function optimizePaymentImage(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Chọn ảnh JPG, PNG hoặc WebP hợp lệ.')
  }
  const dataUrl = await optimizeImage(file)
  const encoded = dataUrl.split(',', 2)[1] ?? ''
  if (Math.floor(encoded.length * 3 / 4) > 600_000) {
    throw new Error('Ảnh sau khi tối ưu vẫn vượt giới hạn 600 KB. Hãy chọn ảnh nhỏ hơn.')
  }
  return dataUrl
}

export type UploadProgress = { phase: 'preparing' | 'uploading' | 'done' | 'error'; percent?: number }

export async function fileToPreviewUrl(file: File) {
  return URL.createObjectURL(file)
}
