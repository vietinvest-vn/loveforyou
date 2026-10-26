import type { Dispatch, FormEventHandler, SetStateAction } from 'react'
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import AuthShell from '../components/auth/AuthShell'
import GoogleLogo from '../components/auth/GoogleLogo'
import type { AuthMode } from '../routing'
import { BirthDatePicker, GenderPicker } from '../components/auth/AuthPickers'

type ValidationErrors = Record<string, string>

type RegisterPageProps = {
  error: string
  busy: boolean
  validationErrors: ValidationErrors
  showPassword: boolean
  setShowPassword: Dispatch<SetStateAction<boolean>>
  showPasswordConfirm: boolean
  setShowPasswordConfirm: Dispatch<SetStateAction<boolean>>
  dateOfBirth: string
  setDateOfBirth: (value: string) => void
  gender: string
  setGender: (value: string) => void
  maxBirthDate: string
  onSubmit: FormEventHandler<HTMLFormElement>
  onFieldChange: (fieldName: string) => void
  onChangeMode: (mode: AuthMode) => void
}

export default function RegisterPage({ error, busy, validationErrors, showPassword, setShowPassword, showPasswordConfirm, setShowPasswordConfirm, dateOfBirth, setDateOfBirth, gender, setGender, maxBirthDate, onSubmit, onFieldChange, onChangeMode }: RegisterPageProps) {
  return <AuthShell mode="register" error={error} onSwitchMode={() => onChangeMode('login')}>
    <form noValidate className="core-form auth-form" onSubmit={onSubmit} onChange={(event) => {
      if (event.target instanceof HTMLInputElement) onFieldChange(event.target.name)
    }}>
      <div className="auth-field-group">
        <label className={`auth-field ${validationErrors.displayName ? 'has-error' : ''}`}><UserRound size={21} aria-hidden="true" /><input name="displayName" autoComplete="name" placeholder="Họ và tên" aria-label="Họ và tên" aria-invalid={Boolean(validationErrors.displayName)} aria-describedby={validationErrors.displayName ? 'displayName-error' : undefined} required minLength={1} maxLength={48} /></label>
        {validationErrors.displayName && <small id="displayName-error" className="auth-field-error" role="alert">{validationErrors.displayName}</small>}
      </div>
      <div className="auth-field-group">
        <label className={`auth-field ${validationErrors.email ? 'has-error' : ''}`}><Mail size={21} aria-hidden="true" /><input name="email" type="email" autoComplete="email" placeholder="Email" aria-label="Email" aria-invalid={Boolean(validationErrors.email)} aria-describedby={validationErrors.email ? 'email-error' : undefined} required maxLength={254} /></label>
        {validationErrors.email && <small id="email-error" className="auth-field-error" role="alert">{validationErrors.email}</small>}
      </div>
      <div className="auth-field-group">
        <label className={`auth-field ${validationErrors.password ? 'has-error' : ''}`}>
          <LockKeyhole size={21} aria-hidden="true" />
          <input name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Mật khẩu" aria-label="Mật khẩu" aria-invalid={Boolean(validationErrors.password)} aria-describedby={validationErrors.password ? 'password-error' : undefined} required minLength={6} maxLength={128} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,128}" title="Mật khẩu cần ít nhất 6 ký tự, gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt." />
          <button className="auth-field-action" type="button" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button>
        </label>
        {validationErrors.password && <small id="password-error" className="auth-field-error" role="alert">{validationErrors.password}</small>}
      </div>
      <p className="auth-password-hint">6–128 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.</p>
      <div className="auth-field-group">
        <label className={`auth-field ${validationErrors.passwordConfirm ? 'has-error' : ''}`}>
          <LockKeyhole size={21} aria-hidden="true" />
          <input name="passwordConfirm" type={showPasswordConfirm ? 'text' : 'password'} autoComplete="new-password" placeholder="Nhập lại mật khẩu" aria-label="Nhập lại mật khẩu" aria-invalid={Boolean(validationErrors.passwordConfirm)} aria-describedby={validationErrors.passwordConfirm ? 'passwordConfirm-error' : undefined} required minLength={6} maxLength={128} />
          <button className="auth-field-action" type="button" aria-label={showPasswordConfirm ? 'Ẩn mật khẩu nhập lại' : 'Hiện mật khẩu nhập lại'} onClick={() => setShowPasswordConfirm((visible) => !visible)}>{showPasswordConfirm ? <EyeOff size={19} /> : <Eye size={19} />}</button>
        </label>
        {validationErrors.passwordConfirm && <small id="passwordConfirm-error" className="auth-field-error" role="alert">{validationErrors.passwordConfirm}</small>}
      </div>
      <BirthDatePicker value={dateOfBirth} onChange={setDateOfBirth} maxDate={maxBirthDate} error={validationErrors.dateOfBirth} />
      <GenderPicker value={gender} onChange={setGender} error={validationErrors.gender} />
      <div className="auth-field-group">
        <div className={`core-terms auth-terms ${validationErrors.termsAccepted ? 'has-error' : ''}`}>
          <input type="checkbox" name="termsAccepted" aria-label="Đồng ý với điều khoản và chính sách bảo mật" aria-invalid={Boolean(validationErrors.termsAccepted)} aria-describedby={validationErrors.termsAccepted ? 'termsAccepted-error' : undefined} required />
          <span>Bằng cách đăng ký, bạn đồng ý với <Link to="/terms" target="_blank" rel="noreferrer">điều khoản sử dụng</Link> và <Link to="/privacy-policy" target="_blank" rel="noreferrer">chính sách bảo mật</Link>.</span>
        </div>
        {validationErrors.termsAccepted && <small id="termsAccepted-error" className="auth-field-error" role="alert">{validationErrors.termsAccepted}</small>}
      </div>
      <button className="core-primary auth-submit" disabled={busy}>{busy ? 'Đang xử lý...' : 'Đăng ký'} <ArrowRight size={21} /></button>
    </form>
    <div className="auth-or"><span />Hoặc<span /></div>
    <div className="auth-social-options auth-register-social-options">
      <button type="button" disabled><GoogleLogo /> Đăng ký với Google <small>Đang phát triển</small></button>
    </div>
  </AuthShell>
}