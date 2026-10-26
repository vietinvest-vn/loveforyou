export function ProfileAvatarIllustration() {
  return <svg className="profile-main-avatar" viewBox="0 0 100 100" role="img" aria-label="?nh d?i di?n minh h?a">
    <defs>
      <linearGradient id="profile-avatar-bg" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ffe9f0" /><stop offset="1" stopColor="#ffc7dc" /></linearGradient>
      <linearGradient id="profile-avatar-skin" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#ffd5b9" /><stop offset="1" stopColor="#eea889" /></linearGradient>
      <linearGradient id="profile-avatar-hair" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#47322f" /><stop offset="1" stopColor="#211f2b" /></linearGradient>
    </defs>
    <circle cx="50" cy="50" r="49" fill="url(#profile-avatar-bg)" />
    <path d="M9 101c2-21 16-34 41-34s39 13 41 34H9Z" fill="#34465d" />
    <path d="m32 69 18 17 18-17-6-8H38l-6 8Z" fill="#fff" />
    <path d="M27 42c-2-19 6-33 23-35 18-2 29 11 26 32l-2 21H27V42Z" fill="url(#profile-avatar-hair)" />
    <path d="M31 42c0-17 7-26 20-26s20 9 20 26v12c0 14-9 23-20 23S31 68 31 54V42Z" fill="url(#profile-avatar-skin)" />
    <path d="M28 44c-2-16 5-32 21-35 16-3 29 7 28 27-7-2-12-9-14-15-7 10-20 15-35 14l-1 16-5 4-3-11Z" fill="url(#profile-avatar-hair)" />
    <path d="M35 47c3-3 7-3 10 0M56 47c3-3 7-3 10 0" fill="none" stroke="#513934" strokeLinecap="round" strokeWidth="2" />
    <ellipse cx="41" cy="52" rx="3.2" ry="4" fill="#fff" /><ellipse cx="60" cy="52" rx="3.2" ry="4" fill="#fff" />
    <ellipse cx="42" cy="53" rx="2" ry="3" fill="#4a4050" /><ellipse cx="61" cy="53" rx="2" ry="3" fill="#4a4050" />
    <circle cx="42.7" cy="51.8" r="1" fill="#fff" /><circle cx="61.7" cy="51.8" r="1" fill="#fff" />
    <path d="m50 54-1.5 7 3 1" fill="none" stroke="#d38a76" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M46 66c2 2 6 2 9 0" fill="none" stroke="#a95261" strokeLinecap="round" strokeWidth="1.8" />
    <circle cx="36" cy="60" r="3" fill="#ee8e91" opacity=".35" /><circle cx="66" cy="60" r="3" fill="#ee8e91" opacity=".35" />
    <path d="m33 71 17 15 17-15-5-6-12 8-12-8-5 6Z" fill="#fff" />
  </svg>
}
