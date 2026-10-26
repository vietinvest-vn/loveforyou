import type { FormEventHandler } from 'react'
import type { ApiProfile } from '../apiClient'

type ProfileEditPageProps = {
  profile: ApiProfile
  onSubmit: FormEventHandler<HTMLFormElement>
  onCancel: () => void
}

export default function ProfileEditPage({ profile, onSubmit, onCancel }: ProfileEditPageProps) {
  return <form className="core-form core-panel profile-edit-form" onSubmit={onSubmit}>
    <h2>Thông tin tài khoản</h2>
    <label>Tên hiển thị<input name="displayName" defaultValue={profile.displayName} maxLength={48} required /></label>
    <label>Bio<textarea name="bio" defaultValue={profile.bio} maxLength={160} rows={3} placeholder="Viết vài dòng giới thiệu về bạn" /></label>
    <label>Email<input value={profile.email} readOnly /></label>
    <label>ID LoveForYou<input value={profile.publicId} readOnly /></label>
    <div className="profile-edit-actions"><button className="core-primary">Lưu thay đổi</button><button type="button" className="core-secondary" onClick={onCancel}>Hủy</button></div>
  </form>
}