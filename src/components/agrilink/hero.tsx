'use client'

// AgriLink hero — premium claymorphism: multi-color clay chips, floating
// produce, count-up trust stats, delivery promise. Framer-motion entrance.

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { apiGet, rs, type Stats } from '@/lib/agrilink-client'
import { makeT } from '@/lib/agrilink-i18n'
import { useAgriLink } from '@/store/agrilink'
import { BadgeCheck, Bike, Leaf, Sparkles, Zap } from 'lucide-react'

function CountUp({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const [n, setN] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !started.current) {
        started.current = true
        const t0 = performance.now()
        const dur = 900
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / dur)
          setN(Math.round(value * (1 - Math.pow(1 - p, 3))))
          if (p < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [value])
  return (
    <span ref={ref}>
      {prefix}
      {n.toLocaleString('en-IN')}
      {suffix}
    </span>
  )
}

const FLOATIES = [
  { emoji: '🍅', cls: 'left-[4%] top-[16%]', delay: 0, dur: 'al-float' },
  { emoji: '🥭', cls: 'right-[6%] top-[10%]', delay: 0.6, dur: 'al-float-slow' },
  { emoji: '🥬', cls: 'left-[10%] bottom-[12%]', delay: 1.1, dur: 'al-float-fast' },
  { emoji: '🥕', cls: 'right-[12%] bottom-[18%]', delay: 0.3, dur: 'al-float' },
  { emoji: '🫑', cls: 'left-[45%] top-[4%]', delay: 0.9, dur: 'al-float-slow' },
]

export function Hero() {
  const { lang, setAiOpen } = useAgriLink()
  const t = makeT(lang)
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: () => apiGet<Stats>('/api/stats') })

  const stat = (icon: React.ReactNode, value: React.ReactNode, label: string, tone: string) => (
    <div className={`clay ${tone} flex items-center gap-2 rounded-2xl px-3 py-2.5`}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--al-glass-strong)] text-sm shadow-sm">{icon}</span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-black text-foreground">{value}</span>
        <span className="block truncate text-[10px] font-semibold text-foreground/60">{label}</span>
      </span>
    </div>
  )

  return (
    <section className="relative overflow-hidden">
      {/* floating produce — emoji on soft clay medallions so they feel sculpted */}
      {FLOATIES.map((f, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 + i * 0.12, type: 'spring', stiffness: 120 }}
          className={`al-clay-emoji pointer-events-none absolute z-0 hidden h-16 w-16 items-center justify-center rounded-full sm:flex md:h-20 md:w-20 ${f.cls}`}
        >
          <span className={`${f.dur} inline-block text-3xl drop-shadow-[0_8px_10px_rgba(120,90,30,0.25)] md:text-4xl`} style={{ animationDelay: `${f.delay}s` }}>
            {f.emoji}
          </span>
        </motion.span>
      ))}

      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-10 pt-10 sm:pt-14 lg:pb-14">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="neu mx-auto mb-4 flex w-fit items-center gap-2 px-4 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="al-pulse-dot absolute inline-flex h-full w-full rounded-full bg-[#17a24f]" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#17a24f]" />
              </span>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--al-ink)]">{t('heroBadge')}</span>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
            className="font-display text-balance text-4xl font-extrabold leading-[1.08] tracking-tight text-[var(--al-headline)] sm:text-5xl lg:text-6xl"
          >
            {t('heroTitle').split('—')[0]}
            <span className="bg-gradient-to-r from-[#17a24f] via-[#84cc16] to-[#f59e0b] bg-clip-text text-transparent">
              {t('heroTitle').includes('—') ? '—' + t('heroTitle').split('—')[1] : ''}
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.16 }}
            className="mx-auto mt-4 max-w-2xl text-pretty text-sm font-medium leading-relaxed text-foreground/70 sm:text-base"
          >
            {t('heroSub')}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.24 }}
            className="mt-6 flex flex-wrap items-center justify-center gap-3"
          >
            <Button size="lg" className="al-add h-12 gap-2 rounded-full px-7 text-sm font-black" onClick={() => document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' })}>
              <Leaf className="h-5 w-5" /> {t('shopNow')}
            </Button>
            <Button size="lg" className="neu h-12 gap-2 rounded-full px-6 text-sm font-extrabold text-[var(--al-mango-ink)]" onClick={() => setAiOpen(true)}>
              <Sparkles className="h-5 w-5 text-[var(--al-amber)]" /> {t('aiAssistant')}
            </Button>
          </motion.div>

          {/* promise chips */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.32 }}
            className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[11px] font-bold"
          >
            <span className="clay-mango flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[var(--al-amber-deep)]">
              <Bike className="h-3.5 w-3.5" /> {t('etaPromise')}
            </span>
            <span className="clay-green flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[var(--al-ink)]">
              <Zap className="h-3.5 w-3.5" /> {t('trustInstant')}
            </span>
            <span className="clay-lime flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[var(--al-olive)]">
              <BadgeCheck className="h-3.5 w-3.5" /> {t('trustChem')}
            </span>
          </motion.div>
        </div>

        {/* trust stats */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.42 }}
            className="mx-auto mt-8 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4"
          >
            {stat(<span>🚜</span>, <CountUp value={stats.farmers} />, lang === 'hi' ? 'वेरिफाइड किसान' : 'Verified farmers', 'clay-green')}
            {stat(<span>🛵</span>, <CountUp value={stats.orders} />, lang === 'hi' ? 'ऑर्डर डिलीवर' : 'Orders delivered', 'clay-sky')}
            {stat(<span>⚡</span>, <CountUp value={Math.round(stats.paidToFarmersRs)} prefix="₹" />, lang === 'hi' ? 'किसानों को भुगतान' : 'Paid to farmers', 'clay-mango')}
            {stat(<span>💚</span>, <CountUp value={stats.avgFarmerSharePct} suffix="%" />, lang === 'hi' ? 'किसान हिस्सा' : 'Farmer share', 'clay-tomato')}
          </motion.div>
        )}
      </div>
    </section>
  )
}
