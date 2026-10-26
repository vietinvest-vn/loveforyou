import type { ReactNode } from 'react'
import { ArrowRight, CircleAlert, Heart } from 'lucide-react'
import type { AuthMode } from '../../routing'

type AuthShellProps = {
  mode: AuthMode
  error: string
  children: ReactNode
  onSwitchMode: () => void
}

export default function AuthShell({ mode, error, children, onSwitchMode }: AuthShellProps) {
  return (
    <main className={`core-auth ${mode === 'register' ? 'is-registering' : 'is-logging-in'}`}>
      <div className={`auth-hero ${mode === 'login' ? 'auth-login-hero' : ''}`}>
        <div className="auth-hero-copy">
          <div className="auth-brand"><Heart size={52} strokeWidth={2.5} /><span>LoveForYou</span></div>
          <p>Kết nối trái tim</p>
          <p>Tìm thấy một nửa của bạn</p>
          <div className="auth-heart-divider"><span /><Heart size={15} fill="currentColor" /><span /></div>
        </div>
        <span className="auth-floating-heart auth-floating-heart-one"><Heart size={23} fill="currentColor" /></span>
        <span className="auth-floating-heart auth-floating-heart-two"><Heart size={16} /></span>
      </div>
      <section className="core-auth-card">
        <header className={`auth-card-heading ${mode === 'login' ? 'auth-login-heading' : ''}`}>
          <h1>{mode === 'login' ? <>Chào mừng bạn trở lại! <Heart size={25} /></> : 'Đăng ký tài khoản'}</h1>
          <p>{mode === 'login' ? <>Cùng LoveForYou tiếp tục hành trình tìm kiếm<br className="auth-login-line-break" /> một nửa của bạn nhé! <Heart size={14} fill="currentColor" /></> : <>Bắt đầu hành trình tìm kiếm tình yêu của bạn <Heart size={14} fill="currentColor" /></>}</p>
        </header>
        {error && <p className="core-error auth-validation-error" role="alert"><CircleAlert size={16} />{error}</p>}
        {children}
        <p className="auth-switch">{mode === 'login' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'} <button type="button" onClick={onSwitchMode}>{mode === 'login' ? 'Đăng ký' : 'Đăng nhập'} <ArrowRight size={16} /></button></p>
      </section>
      {mode === 'login' && <footer className="auth-login-footer"><p>Tình yêu không ở đâu xa,<br />nó bắt đầu từ những điều đơn giản...</p><div className="auth-heart-divider"><span /><Heart size={15} fill="currentColor" /><span /></div></footer>}
    </main>
  )
}