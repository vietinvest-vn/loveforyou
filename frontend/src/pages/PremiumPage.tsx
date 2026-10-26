import { useState } from 'react'
import { Check, Crown, Gift, Heart, LockKeyhole, ShieldCheck, Sparkles, Star, UsersRound } from 'lucide-react'

type BillingCycle = 'month' | 'year'
type PlanId = 'basic' | 'vip' | 'family'

const plans: { id: PlanId; name: string; monthly: number; yearly: number; description: string; features: string[]; icon: typeof Heart }[] = [
  {
    id: 'basic',
    name: 'Gói Cơ bản',
    monthly: 49_000,
    yearly: 490_000,
    description: 'Bắt đầu hành trình kết nối',
    features: ['Gửi 10 lượt thích/ngày', 'Xem ai đã thích bạn', 'Nhắn tin không giới hạn', 'Hồ sơ nổi bật'],
    icon: Heart,
  },
  {
    id: 'vip',
    name: 'Gói VIP',
    monthly: 89_000,
    yearly: 890_000,
    description: 'Trải nghiệm cao cấp, ưu tiên đặc quyền',
    features: ['Gửi 50 lượt thích/ngày', 'Xem ai đã thích bạn', 'Nhắn tin không giới hạn', 'Hồ sơ nổi bật VIP', 'Ưu tiên hiển thị', 'Tham gia sự kiện riêng'],
    icon: Crown,
  },
  {
    id: 'family',
    name: 'Gói Gia đình',
    monthly: 149_000,
    yearly: 1_490_000,
    description: 'Kết nối cùng người thân, chia sẻ yêu thương',
    features: ['Gửi 100 lượt thích/ngày', 'Xem ai đã thích bạn', 'Nhắn tin không giới hạn', 'Hồ sơ nổi bật VIP', 'Tạo nhóm gia đình', 'Ưu đãi thành viên'],
    icon: UsersRound,
  },
]

const formatPrice = (price: number) => new Intl.NumberFormat('vi-VN').format(price)

export default function PremiumPage({ onNotice }: { onNotice: (message: string) => void }) {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('month')
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('vip')

  function choosePlan(plan: typeof plans[number]) {
    setSelectedPlan(plan.id)
    onNotice(`Bạn đã chọn ${plan.name}. Thanh toán Premium chưa được tích hợp.`)
  }

  return <div className="premium-page">
    <section className="premium-hero">
      <div className="premium-hero-copy">
        <span className="premium-kicker"><Crown size={13} fill="currentColor" /> PREMIUM</span>
        <h2>Trải nghiệm<br />tình yêu trọn vẹn</h2>
        <p>Mở khóa tất cả tính năng cao cấp, kết nối dễ dàng hơn và tìm thấy người phù hợp với bạn.</p>
        <a href="#premium-plans" className="premium-hero-action">Khám phá quyền lợi <span>›</span></a>
      </div>
      <div className="premium-hero-art" aria-hidden="true">
        <span className="premium-orbit premium-orbit-one" />
        <span className="premium-orbit premium-orbit-two" />
        <Heart className="premium-art-heart" size={86} fill="currentColor" />
        <Crown className="premium-art-crown" size={48} fill="currentColor" />
        <Sparkles className="premium-art-sparkle premium-art-sparkle-one" size={17} />
        <Sparkles className="premium-art-sparkle premium-art-sparkle-two" size={13} />
      </div>
    </section>

    <div className="premium-billing" role="group" aria-label="Chu kỳ thanh toán">
      <button type="button" className={billingCycle === 'month' ? 'is-selected' : ''} aria-pressed={billingCycle === 'month'} onClick={() => setBillingCycle('month')}>
        <strong>Theo tháng</strong><small>Tiết kiệm hơn</small>
      </button>
      <button type="button" className={billingCycle === 'year' ? 'is-selected' : ''} aria-pressed={billingCycle === 'year'} onClick={() => setBillingCycle('year')}>
        <strong>Theo năm</strong><small>Tiết kiệm 2 tháng</small><span>Tiết kiệm 17%</span>
      </button>
    </div>

    <section id="premium-plans" className="premium-plans" aria-label="Chọn gói Premium">
      {plans.map((plan) => {
        const Icon = plan.icon
        const selected = selectedPlan === plan.id
        const price = billingCycle === 'month' ? plan.monthly : plan.yearly
        return <article className={`premium-plan premium-plan-${plan.id} ${selected ? 'is-selected' : ''}`} key={plan.id}>
          {plan.id === 'vip' && <span className="premium-plan-badge">Phổ biến nhất</span>}
          <span className="premium-plan-icon"><Icon size={25} fill={plan.id === 'family' ? 'none' : 'currentColor'} /></span>
          <h3>{plan.name}</h3>
          <p className="premium-plan-description">{plan.description}</p>
          <p className="premium-plan-price"><strong>{formatPrice(price)}đ</strong><span>/{billingCycle === 'month' ? 'tháng' : 'năm'}</span></p>
          <ul>{plan.features.map((feature) => <li key={feature}><Check size={13} />{feature}</li>)}</ul>
          <button type="button" className="premium-plan-choose" aria-pressed={selected} onClick={() => choosePlan(plan)}>{selected ? 'Đang chọn' : 'Chọn gói'} <span>›</span></button>
        </article>
      })}
    </section>

    <section className="premium-benefits">
      <header><div><h2>Quyền lợi nổi bật</h2><p>Thêm nhiều cách để gần nhau hơn</p></div><LockKeyhole size={19} /></header>
      <div className="premium-benefit-grid">
        <span><Heart size={20} fill="currentColor" /><small>Tăng cơ hội<br />kết nối</small></span>
        <span><Star size={20} fill="currentColor" /><small>Ưu tiên<br />hiển thị</small></span>
        <span><ShieldCheck size={20} /><small>Bảo mật<br />thông tin</small></span>
        <span><Gift size={20} /><small>Sự kiện<br />độc quyền</small></span>
        <span><Crown size={20} /><small>Hỗ trợ<br />ưu tiên</small></span>
      </div>
    </section>

    <section className="premium-bottom-cta">
      <span className="premium-bottom-crown"><Crown size={35} fill="currentColor" /></span>
      <div><small>Nâng cấp ngay để tận hưởng</small><strong>trải nghiệm tốt nhất!</strong></div>
      <button type="button" onClick={() => choosePlan(plans.find((plan) => plan.id === selectedPlan) ?? plans[1])}>Nâng cấp Premium <span>›</span></button>
    </section>
  </div>
}