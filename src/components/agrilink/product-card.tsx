'use client'

// Product card — the Blinkit-style ADD interaction, dressed in clay.
// Emoji hero on tinted clay, freshness ring, farmer line (tap → store),
// harvested-ago chip, rating, low-stock urgency, price + strike MRP,
// ADD / stepper with springy qty animation.

import { motion } from 'framer-motion'
import { Minus, Plus, Star } from 'lucide-react'
import { accentOf, harvestedLabel, type Product, rs } from '@/lib/agrilink-client'
import { makeT } from '@/lib/agrilink-i18n'
import { useAgriLink } from '@/store/agrilink'
import { FreshnessRing } from './freshness-ring'

export function ProductCard({ product }: { product: Product }) {
  const { lang, add, decrement, qtyOf, openProduct, openFarmer } = useAgriLink()
  const t = makeT(lang)
  const accent = accentOf(product.accent)
  const qty = qtyOf(product.id)
  const lowStock = product.stockKg > 0 && product.stockKg <= 12

  const open = () => openProduct(product.id)

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 160, damping: 20 }}
      className="clay clay-hover group relative flex cursor-pointer flex-col overflow-hidden transition-[transform,box-shadow] duration-300 hover:-translate-y-1.5 hover:shadow-[0_22px_36px_-14px_rgba(120,92,40,0.42)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#17a24f] active:translate-y-0"
      onClick={open}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          open()
        }
      }}
      aria-label={`${product.name}, ${rs(product.priceRs)} per ${product.unitLabel}`}
    >
      {/* emoji hero */}
      <div className={`relative flex h-32 items-center justify-center ${accent.bg}`}>
        <span className="al-float text-6xl drop-shadow-[0_10px_12px_rgba(120,90,30,0.28)] transition-transform duration-500 group-hover:rotate-[8deg] group-hover:scale-125" style={{ animationDelay: `${(product.name.length % 5) * 0.4}s` }}>
          {product.emoji}
        </span>
        {product.isBestseller && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-[#f59e0b] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white shadow-md">
            🔥 {t('bestSellerTag')}
          </span>
        )}
        <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-[var(--al-glass-max)] px-1.5 py-1 shadow-sm backdrop-blur">
          <FreshnessRing harvestedAt={product.harvestedAt} size={34} />
        </span>
        <span className="absolute bottom-2 left-2.5 rounded-full bg-[var(--al-glass-max)] px-2 py-0.5 text-[9px] font-extrabold text-[var(--al-ink-soft)] shadow-sm backdrop-blur">
          🌿 {t('chemFree')}
        </span>
        {lowStock && (
          <span className="al-pop absolute bottom-2 right-2.5 rounded-full bg-[#dc2626] px-2 py-0.5 text-[9px] font-black text-white shadow-md">
            ⚡ {t('onlyLeft').replace('{n}', String(Math.ceil(product.stockKg)))}
          </span>
        )}
      </div>

      {/* body */}
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex items-start justify-between gap-1">
          <h3 className="text-sm font-extrabold leading-tight text-foreground">{lang === 'hi' ? product.nameHi : product.name}</h3>
          <span className="shrink-0 rounded-md bg-[var(--al-panel)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--al-brown)]">{product.unitLabel}</span>
        </div>

        <div className="flex items-center justify-between gap-1">
          <button
            className="flex min-w-0 items-center gap-1 text-[11px] font-semibold text-muted-foreground transition hover:text-[var(--al-ink)]"
            onClick={(e) => {
              e.stopPropagation()
              openFarmer(product.farmer.id)
            }}
            aria-label={`${t('viewStore')}: ${product.farmer.name}`}
          >
            <span className="text-sm" aria-hidden>
              {product.farmer.avatar}
            </span>
            <span className="truncate underline decoration-dotted underline-offset-2">
              {t('soldBy')} {product.farmer.name}
            </span>
          </button>
          <span className="flex shrink-0 items-center gap-0.5 text-[10px] font-bold text-[var(--al-brown)]">
            <Star className="h-3 w-3 fill-[#f59e0b] text-[#f59e0b]" />
            {product.rating}
            {product.reviewCount > 0 && <span className="text-[var(--al-sand)]">({product.reviewCount})</span>}
          </span>
        </div>

        <p className="text-[10px] font-bold text-[var(--al-teal)]">🌱 {harvestedLabel(product.harvestedAt, lang)}</p>

        <div className="mt-auto flex items-end justify-between pt-1">
          <div className="leading-none">
            <span className="text-base font-black text-foreground">{rs(product.priceRs)}</span>
            {product.mrpRs > product.priceRs && <span className="ml-1.5 text-[11px] font-semibold text-muted-foreground line-through">{rs(product.mrpRs)}</span>}
            {product.mrpRs > product.priceRs && (
              <span className="mt-0.5 block text-[9px] font-extrabold text-[var(--al-amber)]">{Math.round(((product.mrpRs - product.priceRs) / product.mrpRs) * 100)}% OFF</span>
            )}
          </div>

          <div onClick={(e) => e.stopPropagation()}>
            {qty === 0 ? (
              <button className="al-add h-9 px-4 text-xs font-black transition-transform active:scale-90" onClick={() => add(product.id)} aria-label={`Add ${product.name}`}>
                {t('addToCart')}
              </button>
            ) : (
              <motion.div layout className="al-add flex h-9 items-center gap-2 px-1.5" initial={{ scale: 0.85 }} animate={{ scale: 1 }}>
                <button className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/25 transition hover:bg-white/40" onClick={() => decrement(product.id)} aria-label={`Reduce ${product.name}`}>
                  <Minus className="h-4 w-4" />
                </button>
                <motion.span key={qty} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="min-w-4 text-center text-sm font-black">
                  {qty}
                </motion.span>
                <button className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/25 transition hover:bg-white/40" onClick={() => add(product.id)} aria-label={`Add one more ${product.name}`}>
                  <Plus className="h-4 w-4" />
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </motion.article>
  )
}
