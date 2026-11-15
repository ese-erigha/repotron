import { useId } from 'react'

type AppLogoProps = { className?: string }

/** The mark of Repotron: a citation bracket around one source. */
export function AppLogo({ className }: AppLogoProps) {
  const gradientId = useId()

  return (
    <svg aria-hidden viewBox="0 0 28 28" className={className}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--color-glow)" />
          <stop offset="1" stopColor="var(--color-accent)" />
        </linearGradient>
      </defs>
      <rect width="28" height="28" rx="8" fill="var(--color-ink)" />
      <path
        d="M11 8.5H8.5v11H11M17 8.5h2.5v11H17"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="14" cy="14" r="2.4" fill={`url(#${gradientId})`} />
    </svg>
  )
}
