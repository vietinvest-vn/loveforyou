export type GiftCategory = 'rose' | 'teddy' | 'sweet' | 'special' | 'vip'
export type GiftItem = { id: string; name: string; price: number; art: string; category: GiftCategory; popular?: boolean }

export const giftItems: GiftItem[] = [
  { id: 'rose-bouquet', name: 'Bó hoa hồng', price: 50, art: '💐', category: 'rose', popular: true },
  { id: 'love-teddy', name: 'Gấu bông tình yêu', price: 100, art: '🧸', category: 'teddy' },
  { id: 'crystal-heart', name: 'Trái tim pha lê', price: 200, art: '💖', category: 'special' },
  { id: 'sweet-cake', name: 'Bánh ngọt', price: 300, art: '🎂', category: 'sweet' },
  { id: 'love-car', name: 'Siêu xe tình yêu', price: 500, art: '🏎️', category: 'special' },
  { id: 'love-fireworks', name: 'Pháo hoa tình yêu', price: 1000, art: '🎆', category: 'special' },
  { id: 'heart-crown', name: 'Vương miện', price: 2000, art: '👑', category: 'vip' },
  { id: 'love-flight', name: 'Chuyến bay tình yêu', price: 5000, art: '💝', category: 'vip' },
]
