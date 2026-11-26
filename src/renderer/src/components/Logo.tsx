/** IO Convert mark: the letters I and O, the I in amber like a file mid-conversion. */
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="9" fill="#12213f" stroke="#34508a" />
      <rect x="7.5" y="9" width="3.4" height="14" rx="1.7" fill="#f4b860" />
      <circle cx="19.5" cy="16" r="5.6" fill="none" stroke="#6fb6ff" strokeWidth="3.4" />
    </svg>
  )
}
