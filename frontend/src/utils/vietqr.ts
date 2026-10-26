type VietQrOptions = {
  bankBin: string
  accountNumber: string
  accountHolder: string
  amount: number
  transferContent: string
}

export function createVietQrImageUrl({
  bankBin,
  accountNumber,
  accountHolder,
  amount,
  transferContent,
}: VietQrOptions) {
  if (!/^\d{6}$/.test(bankBin) || !/^\d{4,40}$/.test(accountNumber) || !Number.isSafeInteger(amount) || amount < 1) {
    return ''
  }

  const query = new URLSearchParams({
    amount: String(amount),
    addInfo: transferContent,
    accountName: accountHolder,
  })

  return `https://img.vietqr.io/image/${bankBin}-${accountNumber}-compact2.svg?${query}`
}
