import { Bell, ChevronRight, FileText, Globe2, Headphones, Heart, LockKeyhole, LogOut, Palette, ShieldCheck } from 'lucide-react'
import type { ApiConnection, ApiProfile } from '../apiClient'
import type { Page } from '../routing'

type SettingsPageProps = {
  profile: ApiProfile
  connection: ApiConnection
  initials: (name: string) => string
  onNavigate: (page: Page) => void
  onLogout: () => void
  onNotice: (message: string) => void
}

export default function SettingsPage({ profile, connection, initials, onNavigate, onLogout, onNotice }: SettingsPageProps) {
  return <div className="settings-page">
    <section className="settings-profile">
      <span className="settings-avatar" aria-hidden="true">{initials(profile.displayName)}</span>
      <div className="settings-profile-copy">
        <h2>{profile.displayName} <Heart size={14} fill="currentColor" /></h2>
        <p>@{profile.publicId}</p>
        <span className={`profile-relationship-badge ${connection.relationship ? 'is-connected' : ''}`}><Heart size={11} fill="currentColor" />{connection.relationship ? 'Đang yêu' : 'Chưa kết nối'}</span>
        {profile.bio && <small>{profile.bio}</small>}
      </div>
      <p className="settings-note" aria-hidden="true">Cùng nhau<br />tạo nên những<br />kỷ niệm đẹp <Heart size={12} fill="currentColor" /></p>
    </section>

    <section className="settings-group" aria-label="Cài đặt tài khoản">
      <button type="button" className="settings-row" onClick={() => onNavigate('profile-edit')}>
        <span className="settings-row-icon"><ShieldCheck size={19} /></span><span className="settings-row-copy"><strong>Tài khoản và bảo mật</strong><small>Quản lý thông tin tài khoản</small></span><ChevronRight size={17} />
      </button>
      <button type="button" className="settings-row" onClick={() => onNavigate('notifications')}>
        <span className="settings-row-icon"><Bell size={19} /></span><span className="settings-row-copy"><strong>Thông báo</strong><small>Quản lý thông báo ứng dụng</small></span><ChevronRight size={17} />
      </button>
      <button type="button" className="settings-row" onClick={() => onNavigate('privacy')}>
        <span className="settings-row-icon"><LockKeyhole size={19} /></span><span className="settings-row-copy"><strong>Quyền riêng tư</strong><small>Ai có thể xem hồ sơ của bạn</small></span><ChevronRight size={17} />
      </button>
      <button type="button" className="settings-row" onClick={() => onNotice('Ứng dụng hiện đang sử dụng Tiếng Việt.')}>
        <span className="settings-row-icon"><Globe2 size={19} /></span><span className="settings-row-copy"><strong>Ngôn ngữ</strong><small>Tiếng Việt</small></span><span className="settings-row-value">Tiếng Việt</span><ChevronRight size={17} />
      </button>
      <button type="button" className="settings-row" onClick={() => onNotice('Giao diện sáng đang được sử dụng.')}>
        <span className="settings-row-icon"><Palette size={19} /></span><span className="settings-row-copy"><strong>Giao diện</strong><small>Chế độ sáng / tối</small></span><span className="settings-row-value">Sáng</span><ChevronRight size={17} />
      </button>
    </section>

    <section className="settings-group" aria-label="Thông tin và hỗ trợ">
      <button type="button" className="settings-row" onClick={() => onNotice('Trung tâm hỗ trợ sẽ sớm có mặt.')}>
        <span className="settings-row-icon"><Headphones size={19} /></span><span className="settings-row-copy"><strong>Hỗ trợ khách hàng</strong><small>Câu hỏi thường gặp, liên hệ hỗ trợ</small></span><ChevronRight size={17} />
      </button>
      <button type="button" className="settings-row" onClick={() => onNavigate('terms')}>
        <span className="settings-row-icon"><FileText size={19} /></span><span className="settings-row-copy"><strong>Điều khoản sử dụng</strong><small>Quy định và điều khoản</small></span><ChevronRight size={17} />
      </button>
      <button type="button" className="settings-row" onClick={() => onNavigate('privacy-policy')}>
        <span className="settings-row-icon"><ShieldCheck size={19} /></span><span className="settings-row-copy"><strong>Chính sách bảo mật</strong><small>Bảo vệ thông tin cá nhân</small></span><ChevronRight size={17} />
      </button>
      <button type="button" className="settings-row" onClick={() => onNavigate('admin')}>
        <span className="settings-row-icon"><Heart size={19} fill="currentColor" /></span><span className="settings-row-copy"><strong>Bảng điều khiển Admin</strong><small>Quản trị người dùng và hoạt động</small></span><span className="settings-row-value">Mở</span><ChevronRight size={17} />
      </button>
      <button type="button" className="settings-row" onClick={() => onNotice('LoveForYou · Kết nối yêu thương.')}>
        <span className="settings-row-icon"><Heart size={19} fill="currentColor" /></span><span className="settings-row-copy"><strong>Giới thiệu ứng dụng</strong><small>LoveForYou - Kết nối yêu thương</small></span><span className="settings-row-value">Phiên bản 1.0.0</span><ChevronRight size={17} />
      </button>
    </section>

    <button type="button" className="settings-logout" onClick={onLogout}>
      <span className="settings-row-icon"><LogOut size={19} /></span><span className="settings-row-copy"><strong>Đăng xuất</strong><small>Đăng xuất khỏi tài khoản hiện tại</small></span><ChevronRight size={17} />
    </button>
    <footer className="settings-footer"><Heart size={14} fill="currentColor" /><strong>LoveForYou</strong><span>Kết nối trái tim, xây dựng hạnh phúc</span></footer>
  </div>
}