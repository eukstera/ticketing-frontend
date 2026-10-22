import { NO_EMAIL_TEXT } from '@/lib/confirmation'

/**
 * A requester's email as a mailto link, or a plain "No email provided" when
 * there is none. Staff only: the API never sends it to the public pages.
 */
export default function RequesterEmail({ email, className = '' }: { email: string | null | undefined; className?: string }) {
  if (!email) return <span className={`text-gray-500 ${className}`}>{NO_EMAIL_TEXT}</span>
  return (
    <a
      // The address is encoded, so a stray "?cc=..." in it can't add mail headers.
      href={`mailto:${encodeURIComponent(email)}`}
      className={`break-all text-blue-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded ${className}`}
    >
      {email}
    </a>
  )
}
