// components/ui/EmptyState.tsx
import Link from 'next/link'
import { Inbox, type LucideIcon } from 'lucide-react'
import { btnSecondary, btnSm } from '@/lib/styles'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  /**
   * Optional call to action: a button ({ label, onClick }, e.g. "Clear filters")
   * or a link styled as a button ({ label, href }, e.g. "Create a ticket").
   */
  action?:
    | { label: string; onClick: () => void; href?: undefined }
    | { label: string; href: string; onClick?: undefined }
  className?: string
}

export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center text-center px-4 py-12 ${className}`}>
      <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center mb-3">
        <Icon size={18} aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-gray-800">{title}</p>
      {description && <p className="text-sm text-gray-500 mt-1 max-w-sm">{description}</p>}
      {action &&
        (action.href !== undefined ? (
          <Link href={action.href} className={`${btnSecondary} ${btnSm} mt-4`}>
            {action.label}
          </Link>
        ) : (
          <button type="button" onClick={action.onClick} className={`${btnSecondary} ${btnSm} mt-4`}>
            {action.label}
          </button>
        ))}
    </div>
  )
}
