// components/ui/Avatar.tsx
const SIZE_CLASS = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-9 h-9 text-xs',
  lg: 'w-9 h-9 text-sm',
} as const

interface AvatarProps {
  firstName?: string | null
  lastName?: string | null
  size?: keyof typeof SIZE_CLASS
  className?: string
}

/** Initials circle. Decorative: always pair with the person's name as text. */
export default function Avatar({ firstName, lastName, size = 'md', className = '' }: AvatarProps) {
  const initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || 'U'

  return (
    <div
      aria-hidden="true"
      className={`rounded-full bg-blue-100 text-blue-700 font-semibold flex items-center justify-center flex-shrink-0 ${SIZE_CLASS[size]} ${className}`}
    >
      {initials}
    </div>
  )
}
