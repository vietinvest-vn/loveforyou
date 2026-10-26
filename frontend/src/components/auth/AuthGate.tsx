import { useState, type FormEvent } from 'react'
import { api } from '../../apiClient'
import type { ApiUser } from '../../apiClient'
import LoginPage from '../../pages/LoginPage'
import RegisterPage from '../../pages/RegisterPage'
import type { AuthMode } from '../../routing'

type AuthGateProps = {
  mode: AuthMode
  onAuthenticated: (user: ApiUser) => Promise<void>
  initialError: string
  onModeChange: (mode: AuthMode) => void
}

function localDateValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

export default function AuthGate({ mode, onAuthenticated, initialError, onModeChange }: AuthGateProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [gender, setGender] = useState('')
  const [maxBirthDate] = useState(() => localDateValue(new Date()))

  function changeMode(nextMode: AuthMode) {
    onModeChange(nextMode)
    setError('')
    setValidationErrors({})
  }

  function clearFieldError(fieldName: string) {
    if (fieldName) setValidationErrors((current) => {
      const next = { ...current }
      delete next[fieldName]
      if (fieldName === 'password') delete next.passwordConfirm
      return next
    })
    if (error) setError('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const form = event.currentTarget
    const data = new FormData(form)
    const email = String(data.get('email') ?? '').trim()
    const password = String(data.get('password') ?? '')
    const displayName = String(data.get('displayName') ?? '').trim()
    const passwordConfirm = String(data.get('passwordConfirm') ?? '')
    const nextValidationErrors: Record<string, string> = {}

    if (mode === 'register' && !displayName) nextValidationErrors.displayName = 'Vui lòng nhập họ và tên.'
    if (!email) nextValidationErrors.email = 'Vui lòng nhập email.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextValidationErrors.email = 'Email chưa đúng định dạng.'
    if (!password) nextValidationErrors.password = 'Vui lòng nhập mật khẩu.'
    else if (mode === 'register' && !new RegExp('(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{6,128}').test(password)) {
      nextValidationErrors.password = 'Mật khẩu cần đủ độ dài và gồm chữ hoa, chữ thường, số, ký tự đặc biệt.'
    }
    if (mode === 'register' && !passwordConfirm) nextValidationErrors.passwordConfirm = 'Vui lòng nhập lại mật khẩu.'
    else if (mode === 'register' && passwordConfirm !== password) nextValidationErrors.passwordConfirm = 'Mật khẩu nhập lại chưa khớp.'
    if (mode === 'register' && !dateOfBirth) nextValidationErrors.dateOfBirth = 'Vui lòng chọn ngày sinh.'
    if (mode === 'register' && !gender) nextValidationErrors.gender = 'Vui lòng chọn giới tính.'
    if (mode === 'register' && data.get('termsAccepted') !== 'on') nextValidationErrors.termsAccepted = 'Vui lòng đồng ý với điều khoản để tiếp tục.'

    setValidationErrors(nextValidationErrors)
    setError('')
    if (Object.keys(nextValidationErrors).length) {
      const firstInvalidField = Object.keys(nextValidationErrors)[0]
      if (firstInvalidField === 'dateOfBirth' || firstInvalidField === 'gender') {
        form.querySelector<HTMLButtonElement>(`[data-field="${firstInvalidField}"] .auth-picker-trigger`)?.focus()
      } else {
        form.querySelector<HTMLInputElement>(`[name="${firstInvalidField}"]`)?.focus()
      }
      return
    }

    setBusy(true)
    try {
      const user = mode === 'register'
        ? await api.register(email, displayName, password, data.get('termsAccepted') === 'on', dateOfBirth, gender)
        : await api.login(email, password, data.get('rememberMe') === 'on')
      await onAuthenticated(user)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Có lỗi xảy ra. Vui lòng thử lại.')
    } finally {
      setBusy(false)
    }
  }

  const commonProps = {
    error: error || initialError,
    busy,
    onSubmit: submit,
    onChangeMode: changeMode,
    onFieldChange: clearFieldError,
  }

  return mode === 'login'
    ? <LoginPage {...commonProps} showPassword={showPassword} setShowPassword={setShowPassword} />
    : <RegisterPage
        {...commonProps}
        validationErrors={validationErrors}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        showPasswordConfirm={showPasswordConfirm}
        setShowPasswordConfirm={setShowPasswordConfirm}
        dateOfBirth={dateOfBirth}
        setDateOfBirth={(value) => { setDateOfBirth(value); clearFieldError('dateOfBirth') }}
        gender={gender}
        setGender={(value) => { setGender(value); clearFieldError('gender') }}
        maxBirthDate={maxBirthDate}
      />
}