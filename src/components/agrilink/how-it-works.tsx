'use client'

// How it works — 3 clay steps + the honest receipt (middlemen vs AgriLink).

import { motion } from 'framer-motion'
import { makeT } from '@/lib/agrilink-i18n'
import { useAgriLink } from '@/store/agrilink'

export function HowItWorks() {
  const { lang } = useAgriLink()
  const t = makeT(lang)

  const steps = [
    { emoji: '🛒', title: t('step1t'), d: t('step1d'), tone: 'clay-lime' },
    { emoji: '⚡', title: t('step2t'), d: t('step2d'), tone: 'clay-mango' },
    { emoji: '🛵', title: t('step3t'), d: t('step3d'), tone: 'clay-sky' },
  ]

  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <h2 className="text-center font-display text-2xl font-extrabold sm:text-3xl">{t('howItWorks')}</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {steps.map((s, i) => (
          <motion.div
            key={s.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ delay: i * 0.12, duration: 0.5 }}
            className={`clay ${s.tone} relative p-5 text-center`}
          >
            <span className="absolute -top-3 left-1/2 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full bg-[#17a24f] text-xs font-black text-white shadow-md">
              {i + 1}
            </span>
            <span className="al-float inline-block text-4xl" style={{ animationDelay: `${i * 0.5}s` }}>
              {s.emoji}
            </span>
            <h3 className="mt-2.5 text-sm font-black">{s.title}</h3>
            <p className="mt-1 text-xs font-medium leading-relaxed text-foreground/65">{s.d}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

export function ImpactStrip() {
  const { lang } = useAgriLink()
  const t = makeT(lang)
  const mandi = 32
  const agri = 85

  return (
    <section className="mx-auto max-w-7xl px-4 pb-12">
      <div className="clay clay-tomato relative overflow-hidden p-6 sm:p-8">
        <span className="al-float-slow pointer-events-none absolute -right-6 -top-8 text-[110px] opacity-20" aria-hidden>
          🍅
        </span>
        <div className="relative max-w-2xl">
          <h2 className="font-display text-2xl font-extrabold text-[var(--al-tomato-ink)] sm:text-3xl">🧾 {t('impactTitle')}</h2>
          <p className="mt-1 text-sm font-semibold text-[var(--al-tomato-ink-2)]/80">{t('impactSub')}</p>

          <div className="mt-5 space-y-3">
            <div>
              <div className="mb-1 flex justify-between text-[11px] font-black">
                <span className="text-[var(--al-tomato-ink-2)]">🏚️ {t('impactP1')}</span>
                <span className="text-[var(--al-tomato-ink-2)]">{mandi}%</span>
              </div>
              <div className="h-3.5 overflow-hidden rounded-full bg-[var(--al-veil)]">
                <div className="al-grow h-full w-[32%] rounded-full bg-[#f59e0b]" />
              </div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-[11px] font-black">
                <span className="text-[var(--al-ink)]">🌿 AgriLink — {t('impactP2')}</span>
                <span className="text-[var(--al-ink)]">{agri}%</span>
              </div>
              <div className="h-3.5 overflow-hidden rounded-full bg-[var(--al-veil)]">
                <div className="al-grow h-full w-[85%] rounded-full bg-gradient-to-r from-[#17a24f] to-[#84cc16]" />
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs font-bold text-[var(--al-tomato-ink-2)]/80">{lang === 'hi' ? t('footerLine2') : t('footerLine2')} · NABARD 2023: {lang === 'hi' ? 'मंडी व्यवस्था में किसान को मिलता है 22–35%' : 'farmers get 22–35% in mandi chains'}</p>
        </div>
      </div>
    </section>
  )
}
