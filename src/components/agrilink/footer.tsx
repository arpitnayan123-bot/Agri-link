'use client'

// Footer — sticky to the bottom (mt-auto), premium clay style.
// v2: payment trust chips (UPI · Razorpay X · BHIM) + compact link row.

import Image from 'next/image'
import { Landmark, Lock, Smartphone, Zap } from 'lucide-react'
import { makeT } from '@/lib/agrilink-i18n'
import { useAgriLink } from '@/store/agrilink'

export function AgriLinkFooter() {
  const { lang } = useAgriLink()
  const t = makeT(lang)

  const chips = [
    { icon: Smartphone, label: 'UPI Instant' },
    { icon: Zap, label: 'Razorpay X payouts' },
    { icon: Landmark, label: 'BHIM · NPCI' },
    { icon: Lock, label: '100% secure' },
  ]

  return (
    <footer className="mt-auto border-t border-[var(--al-line)] bg-[var(--al-header-soft)] pb-2 pt-6 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 pb-3 text-center">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-[var(--al-card)] shadow-sm">
            <Image src="/agrilink-logo.png" alt="AgriLink logo" width={36} height={36} className="h-7 w-7 object-contain" />
          </span>
          <span className="font-display text-lg font-extrabold text-[var(--al-ink)]">
            Agri<span className="text-[var(--al-green)]">Link</span>
          </span>
        </div>
        <p className="text-xs font-semibold text-muted-foreground">{t('footerLine1')}</p>
        <p className="text-xs font-black text-[var(--al-ink-soft)]">⚡ {t('footerLine2')}</p>

        {/* payment trust chips */}
        <ul className="mt-1 flex flex-wrap items-center justify-center gap-1.5" aria-label="Payments">
          {chips.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="neu flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-extrabold text-[var(--al-brown-2)]"
            >
              <Icon className="h-3.5 w-3.5 text-[var(--al-green)]" aria-hidden />
              {label}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap justify-center gap-3 text-[10px] font-bold text-muted-foreground/70">
          <span>© {new Date().getFullYear()} AgriLink</span>
          <span aria-hidden>·</span>
          <span>Maharashtra × Punjab pilot</span>
          <span aria-hidden>·</span>
          <span>Mock payments &amp; AI for demo</span>
        </div>
      </div>
      {/* safe-area for iOS */}
      <div aria-hidden className="h-[env(safe-area-inset-bottom)]" />
    </footer>
  )
}
