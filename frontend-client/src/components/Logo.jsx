export default function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      {/* Document background */}
      <rect width="28" height="28" rx="6" fill="#1a1a2e"/>
      {/* Document lines */}
      <line x1="6" y1="10" x2="16" y2="10" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.4"/>
      <line x1="6" y1="14" x2="18" y2="14" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.4"/>
      {/* Highlighted risky lines in blue */}
      <line x1="6" y1="18" x2="14" y2="18" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"/>
      <line x1="6" y1="22" x2="16" y2="22" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"/>
      {/* Red flag dot */}
      <circle cx="22" cy="9" r="5" fill="#ef4444"/>
      {/* Flag pole and flag */}
      <line x1="22" y1="6" x2="22" y2="12" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M22 6.5 L26 8 L22 9.5" fill="#ffffff"/>
    </svg>
  )
}