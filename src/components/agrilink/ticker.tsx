'use client'

// Live ticker — marquee of real platform facts. Pauses on hover.

import { useQuery } from '@tanstack/react-query'
import { apiGet, freshnessScore, rs, type Product, type Stats } from '@/lib/agrilink-client'
import { useAgriLink } from '@/store/agrilink'

export function LiveTicker() {
  const { lang } = useAgriLink()
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: () => apiGet<Stats>('/api/stats') })
  const { data: products } = useQuery({ queryKey: ['products', 'all'], queryFn: () => apiGet<Product[]>('/api/products') })

  const freshest = (products ?? [])
    .map((p) => ({ p, s: freshnessScore(p.harvestedAt) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 4)

  const items: string[] = []
  if (stats) {
    items.push(`⚡ ${rs(stats.paidToFarmersRs)} ${lang === 'hi' ? 'किसानों को तुरंत भुगतान' : 'paid instantly to farmers'}`)
    items.push(`🚜 ${stats.farmers} ${lang === 'hi' ? 'वेरिफाइड किसान' : 'verified farmers'} · ${stats.products} ${lang === 'hi' ? 'उपज' : 'products'}`)
    items.push(`🛵 ${lang === 'hi' ? 'औसत डिलीवरी ~2 घंटे' : 'avg delivery ~2 hrs'} · 🌿 100% ${lang === 'hi' ? 'केमिकल-फ़्री' : 'chemical-free'}`)
    items.push(`💚 ${stats.avgFarmerSharePct}% ${lang === 'hi' ? 'हर रुपये का किसान के पास' : 'of every rupee stays with farmers'}`)
  }
  for (const { p, s } of freshest) {
    items.push(`✨ ${p.emoji} ${lang === 'hi' ? p.nameHi : p.name} — ${s}% ${lang === 'hi' ? 'ताज़गी स्कोर' : 'freshness'}`)
  }

  if (!items.length) return null
  const row = items.join('      ·      ')

  return (
    <div className="overflow-hidden border-b border-[var(--al-line)] bg-gradient-to-r from-[var(--al-chip)] via-[var(--al-mango-panel)] to-[var(--al-berry-panel)] py-1.5" aria-hidden>
      <div className="al-marquee whitespace-nowrap text-[11px] font-bold text-[var(--al-olive-2)]">
        <span className="px-2">{row}      ·      </span>
        <span className="px-2">{row}      ·      </span>
      </div>
    </div>
  )
}
