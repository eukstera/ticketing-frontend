import type { Metadata } from 'next'
import './globals.css'
import ToastContainer from '@/components/Toast'

export const metadata: Metadata = {
  title: 'GBTRGHSC Ticketing System',
  description: 'A centralized system for managing support tickets across departments.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {/* Hidden until focused; targets <main id="main"> on each page. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[110] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-blue-700 focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Skip to content
        </a>
        {children}
        <ToastContainer />
      </body>
    </html>
  )
}