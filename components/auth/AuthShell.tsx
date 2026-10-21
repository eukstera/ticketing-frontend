import Image from 'next/image'
import { ReactNode } from 'react'

export default function AuthShell({
  tagline,
  children,
}: {
  tagline: string
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-auth-page flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-[0.85fr_1fr] rounded-[20px] overflow-hidden shadow-2xl border border-black/5">
        {/* LEFT — institutional panel */}
        <div
          className="relative flex flex-col px-9 py-11 text-white overflow-hidden"
          style={{ background: 'linear-gradient(165deg, #123B3E 0%, #0F2B32 100%)' }}
        >
          <div
            className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
              backgroundSize: '20px 20px',
            }}
          />

          {/* Seals flanking the name */}
          <div className="relative z-10 flex items-center gap-4">
            <Image
              src="/images/doh-logo.png"
              alt="Department of Health seal"
              width={64}
              height={64}
              className="object-contain flex-shrink-0"
            />
            <p className="text-[15.5px] font-semibold leading-snug flex-1">
              Governor Benjamin T. Romualdez
              <br />
              General Hospital
              <span className="block text-[11px] uppercase tracking-[0.14em] text-white/50 font-medium mt-1.5">
                Schistosomiasis Center
              </span>
            </p>
            <Image
              src="/images/scisto-logo.jpg"
              alt="Governor Benjamin T. Romualdez General Hospital and Schistosomiasis Center seal"
              width={64}
              height={64}
              className="rounded-full object-cover shadow-lg"
            />
          </div>

          <div className="relative z-10 mt-14">
            <div className="flex items-center gap-2 text-[11.5px] font-mono tracking-[0.16em] uppercase text-orange-400">
              <span className="w-4 h-px bg-orange-400" />
              Support desk
            </div>
            <h1 className="font-serif text-[40px] leading-[1.05] font-medium mt-3.5 mb-4">
              Ticketing
              <br />
              System
            </h1>
            <p className="text-sm leading-relaxed text-white/70 max-w-[280px]">{tagline}</p>
          </div>
        </div>

        {/* RIGHT — form card */}
        <main id="main" className="bg-white px-8 py-10 sm:px-11 sm:py-12 flex flex-col">{children}</main>
      </div>
    </div>
  )
}
