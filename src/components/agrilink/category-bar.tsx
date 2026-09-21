'use client'

// Category chips — neu soft-extruded, active state pressed-in.
// Each chip shows a live count of matching products.

import { CATEGORIES } from '@/lib/agrilink-client'
import { makeT } from '@/lib/agrilink-i18n'
import { useAgriLink } from '@/store/agrilink'

export function CategoryBar({
  value,
  onChange,
  counts,
}: {
  value: string
  onChange: (v: string) => void
  counts?: Record<string, number>
}) {
  const { lang } = useAgriLink()
  const t = makeT(lang)

  return (
    <div className="al-noscroll -mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label={t('categories')}>
      {CATEGORIES.map((c) => {
        const active = value === c.key
        const n = counts?.[c.key]
        return (
          <button
            key={c.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(c.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-extrabold transition-all ${
              active ? 'neu-pressed bg-[#17a24f] text-white shadow-[0_6px_14px_-4px_rgba(23,162,79,0.5)]' : 'neu text-[var(--al-brown-2)] hover:text-[var(--al-ink)]'
            }`}
          >
            <span className="text-sm" aria-hidden>
              {c.emoji}
            </span>
            {lang === 'hi' ? c.hi : c.en}
            {typeof n === 'number' && (
              <span
                className={`ml-0.5 rounded-full px-1.5 py-px text-[9px] font-black ${
                  active ? 'bg-white/25 text-white' : 'bg-[var(--al-chip)] text-[var(--al-ink-soft)]'
                }`}
              >
                {n}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
