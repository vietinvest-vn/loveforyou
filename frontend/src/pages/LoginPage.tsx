import type { Dispatch, FormEventHandler, SetStateAction } from 'react'
import { Apple, ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
import AuthShell from '../components/auth/AuthShell'
import GoogleLogo from '../components/auth/GoogleLogo'
import type { AuthMode } from '../routing'

type LoginPageProps = {
  error: string
  busy: boolean
  showPassword: boolean
  setShowPassword: Dispatch<SetStateAction<boolean>>
  onSubmit: FormEventHandler<HTMLFormElement>
  onChangeMode: (mode: AuthMode) => void
  onFieldChange: (fieldName: string) => void
}

export default function LoginPage({ error, busy, showPassword, setShowPassword, onSubmit, onChangeMode, onFieldChange }: LoginPageProps) {
  return <AuthShell mode="login" error={error} onSwitchMode={() => onChangeMode('register')}>
    <form noValidate className="core-form auth-form auth-login-form" onSubmit={onSubmit} onChange={(event) => {
      if (event.target instanceof HTMLInputElement) onFieldChange(event.target.name)
    }}>
      <label className="auth-field"><Mail size={21} aria-hidden="true" /><input name="email" type="email" autoComplete="email" placeholder="Email" aria-label="Email" required maxLength={254} /></label>
      <label className="auth-field">
        <LockKeyhole size={21} aria-hidden="true" />
        <input name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Mật khẩu" aria-label="Mật khẩu" required maxLength={128} />
        <button className="auth-field-action" type="button" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button>
      </label>
      <div className="auth-login-options">
        <label className="auth-remember"><input type="checkbox" name="rememberMe" defaultChecked /> <span>Nhớ tôi</span></label>
        <button type="button" className="auth-development-link" disabled><span>Quên mật khẩu?</span><small>Đang phát triển</small></button>
      </div>
      <button className="core-primary auth-submit" disabled={busy}>{busy ? 'Đang xử lý...' : 'Đăng nhập'} <ArrowRight size={21} /></button>
    </form>
    <div className="auth-or auth-login-or"><span />Hoặc đăng nhập với<span /></div>
    <div className="auth-social-options auth-login-social-options">
      <button type="button" disabled><GoogleLogo /> Đăng nhập với Google <small>Đang phát triển</small></button>
      <button type="button" disabled><Apple className="apple-mark" size={17} fill="currentColor" /> Đăng nhập với Apple <small>Đang phát triển</small></button>
    </div>
  </AuthShell>
}