'use client'

// Product sheet — detail dialog: hero, freshness, honest price-fairness bars,
// farmer story card, ADD. The "why AgriLink" moment per product.
// v3: live DB reviews + "Rate your harvest" write form (BUYER reviews are
// stored server-side and blended into the displayed rating).

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Minus, Plus, PenLine, ShieldCheck, Sparkles, Star, Store } from 'lucide-react'
import { accentOf, apiGet, apiPost, freshnessColor, freshnessLabel, freshnessScore, rs, type Product, type ReviewsResponse } from '@/lib/agrilink-client'
import { makeT } from '@/lib/agrilink-i18n'
import { useAgriLink } from '@/store/agrilink'
import { FreshnessRing } from './freshness-ring'

function daysAgoLabel(createdAt: string, lang: 'en' | 'hi'): string {
  const days = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000))
  if (days === 0) return lang === 'hi' ? 'आज' : 'today'
  return lang === 'hi' ? `${days}द` : `${days}d`
}

function Stars({ value, size = 3 }: { value: number; size?: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${size === 3 ? 'h-3 w-3' : 'h-4 w-4'} ${i <= Math.round(value) ? 'fill-[#f59e0b] text-[#f59e0b]' : 'fill-transparent text-[var(--al-timeline-idle)]'}`}
        />
      ))}
    </span>
  )
}

export function ProductSheet() {
  const { lang, productSheetId, openProduct, openFarmer, add, decrement, qtyOf, buyer } = useAgriLink()
  const t = makeT(lang)
  const { toast } = useToast()
  const qc = useQueryClient()
  const { data: products } = useQuery({ queryKey: ['products', 'all'], queryFn: () => apiGet<Product[]>('/api/products') })
  const product = useMemo(() => products?.find((p) => p.id === productSheetId) ?? null, [products, productSheetId])
  const qty = product ? qtyOf(product.id) : 0

  // live reviews (BUYER + SEED) + blended average
  const { data: revData } = useQuery({
    queryKey: ['reviews', productSheetId],
    queryFn: () => apiGet<ReviewsResponse>(`/api/reviews?productId=${encodeURIComponent(productSheetId ?? '')}`),
    enabled: !!productSheetId,
  })

  // write-review form state
  const [formOpen, setFormOpen] = useState(false)
  const [rName, setRName] = useState('')
  const [rRating, setRRating] = useState(0)
  const [rHover, setRHover] = useState(0)
  const [rText, setRText] = useState('')
  const [rBusy, setRBusy] = useState(false)
  const [rErr, setRErr] = useState('')

  const openForm = () => {
    setRName(buyer.name || '')
    setRRating(0)
    setRText('')
    setRErr('')
    setFormOpen(true)
  }

  const submitReview = async () => {
    if (!product || rBusy) return
    setRBusy(true)
    setRErr('')
    try {
      await apiPost('/api/reviews', {
        productId: product.id,
        name: rName.trim(),
        rating: rRating,
        comment: rText.trim(),
        buyerPhone: buyer.phone || undefined,
        lang,
      })
      await qc.invalidateQueries({ queryKey: ['reviews', productSheetId] })
      qc.invalidateQueries({ queryKey: ['products'] })
      setFormOpen(false)
      toast({ title: `🌟 ${t('reviewThanks')}` })
    } catch {
      setRErr(t('reviewErr'))
    } finally {
      setRBusy(false)
    }
  }

  const score = product ? freshnessScore(product.harvestedAt) : 0
  const color = freshnessColor(score)
  const accent = product ? accentOf(product.accent) : accentOf('leafy')

  // price fairness — normalize against consumer price
  const bars = product
    ? [
        { label: t('mandiWouldPay'), val: product.mandiPriceRs, color: '#f59e0b', note: lang === 'hi' ? 'बिचौलिए का दाम' : 'what traders pay' },
        { label: t('farmerGets'), val: product.priceRs, color: '#17a24f', note: lang === 'hi' ? 'तुरंत UPI पर' : 'instant UPI payout' },
        { label: t('supermarket'), val: product.mrpRs, color: '#64748b', note: lang === 'hi' ? 'शोरूम कीमत' : 'typical shelf price' },
      ]
    : []
  const maxVal = product ? Math.max(...bars.map((b) => b.val), product.priceRs) : 1
  const displayRating = revData?.avg ?? product?.rating ?? 0
  const reviewCount = revData?.count ?? product?.reviewCount ?? 0

  return (
    <Dialog open={!!productSheetId} onOpenChange={(o) => !o && openProduct(null)}>
      {product && (
        <DialogContent className="al-scroll max-h-[88vh] max-w-lg overflow-y-auto rounded-3xl border-0 p-0">
          <DialogTitle className="sr-only">{product.name}</DialogTitle>
          <DialogDescription className="sr-only">
            {product.description} — {rs(product.priceRs)} per {product.unitLabel}
          </DialogDescription>

          {/* hero */}
          <div className={`relative flex h-44 items-center justify-center ${accent.bg}`}>
            <span className="al-float text-[90px] leading-none drop-shadow-[0_14px_16px_rgba(120,90,30,0.3)]">{product.emoji}</span>
            <button
              className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-[var(--al-glass-max)] px-2.5 py-1.5 text-[11px] font-extrabold shadow-md backdrop-blur"
              style={{ color }}
            >
              <FreshnessRing harvestedAt={product.harvestedAt} size={30} />
              {freshnessLabel(score, lang)}
            </button>
            {product.isBestseller && (
              <span className="absolute left-3 top-3 rounded-full bg-[#f59e0b] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow-md">
                🔥 {t('bestSellerTag')}
              </span>
            )}
          </div>

          <div className="space-y-4 p-5">
            {/* title row */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-extrabold leading-tight">{lang === 'hi' ? product.nameHi : product.name}</h2>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <span className="rounded-md bg-[var(--al-panel)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--al-brown)]">{product.unitLabel}</span>
                  <Star className="h-3.5 w-3.5 fill-[#f59e0b] text-[#f59e0b]" /> {displayRating}
                  {reviewCount > 0 && <span>· {t('reviewsCount').replace('{n}', String(reviewCount))}</span>}
                  {product.chemicalFree && <span className="ml-1 font-extrabold text-[var(--al-ink-soft)]">· 🌿 {t('chemFree')}</span>}
                </p>
              </div>
              <div className="text-right leading-none">
                <span className="text-2xl font-black">{rs(product.priceRs)}</span>
                {product.mrpRs > product.priceRs && <span className="ml-1.5 text-xs font-semibold text-muted-foreground line-through">{rs(product.mrpRs)}</span>}
              </div>
            </div>

            <p className="text-sm leading-relaxed text-foreground/75">{lang === 'hi' ? product.descriptionHi : product.description}</p>

            {/* tags */}
            <div className="flex flex-wrap gap-1.5">
              {(JSON.parse(product.tags || '[]') as string[]).map((tag) => (
                <span key={tag} className="clay-lime rounded-full px-2.5 py-1 text-[10px] font-extrabold text-[var(--al-olive)]">
                  {tag}
                </span>
              ))}
              <span className="clay-sky rounded-full px-2.5 py-1 text-[10px] font-extrabold text-[#1e40af] dark:text-[#a4c3f9]">
                {lang === 'hi' ? `तुड़ाई: ${new Date(product.harvestedAt).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN')}` : `Harvested: ${new Date(product.harvestedAt).toLocaleDateString()}`}
              </span>
            </div>

            {/* price fairness */}
            <div className="clay rounded-2xl p-4">
              <p className="mb-2.5 flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-foreground/70">
                <ShieldCheck className="h-4 w-4 text-[var(--al-green)]" /> {t('priceFairness')}
              </p>
              <div className="space-y-2.5">
                {bars.map((b) => (
                  <div key={b.label}>
                    <div className="mb-1 flex items-baseline justify-between text-[11px] font-bold">
                      <span className="text-foreground/80">{b.label}</span>
                      <span style={{ color: b.color }}>{rs(b.val)}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-[var(--al-inset)]">
                      <div className="al-grow h-full rounded-full" style={{ width: `${(b.val / maxVal) * 100}%`, background: b.color }} />
                    </div>
                    <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">{b.note}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* farmer card */}
            <div className="clay-green rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--al-glass-strong)] text-2xl shadow-sm">{product.farmer.avatar}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-[var(--al-ink)]">
                    {t('meetFarmer')}: {product.farmer.name} {product.farmer.kycVerified && <ShieldCheck className="inline h-3.5 w-3.5 text-[var(--al-green)]" />}
                  </p>
                  <p className="text-[11px] font-semibold text-[var(--al-olive)]">
                    {product.farmer.village}, {product.farmer.district} · {product.farmer.state}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="h-9 shrink-0 gap-1.5 rounded-full bg-[var(--al-glass-strong)] px-3 text-[11px] font-black text-[var(--al-ink)] shadow-sm hover:bg-[var(--al-card)]"
                  onClick={() => {
                    openProduct(null)
                    setTimeout(() => openFarmer(product.farmer.id), 150)
                  }}
                >
                  <Store className="h-3.5 w-3.5" /> {t('viewStore')}
                </Button>
              </div>
              <p className="mt-2.5 rounded-xl bg-[var(--al-veil)] p-2.5 text-[12px] font-medium italic leading-relaxed text-[var(--al-story)]">
                “{lang === 'hi' ? product.farmer.storyHi : product.farmer.story}”
              </p>
            </div>

            {/* reviews — live DB reviews + write form */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-foreground/70">
                  <Sparkles className="h-3.5 w-3.5 text-[var(--al-amber)]" /> {t('reviewsTitle')}
                  {reviewCount > 0 && <span className="text-[10px] font-bold normal-case text-muted-foreground">({t('reviewsCount').replace('{n}', String(reviewCount))})</span>}
                </p>
                {!formOpen && (
                  <button
                    className="neu flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-extrabold text-[var(--al-ink)] transition active:scale-95"
                    onClick={openForm}
                  >
                    <PenLine className="h-3 w-3" /> {t('writeReview')}
                  </button>
                )}
              </div>

              {/* write form */}
              {formOpen && (
                <div className="clay mb-2.5 rounded-2xl p-3">
                  <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-[var(--al-ink)]">🌟 {t('rateHarvest')}</p>
                  <div className="mb-2 flex items-center gap-2.5">
                    <div className="flex items-center gap-1" onMouseLeave={() => setRHover(0)} role="radiogroup" aria-label={t('rating')}>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <button
                          key={i}
                          type="button"
                          onMouseEnter={() => setRHover(i)}
                          onClick={() => setRRating(i)}
                          className="transition-transform hover:scale-125 active:scale-95"
                          aria-label={`${i} star${i > 1 ? 's' : ''}`}
                          aria-pressed={rRating === i}
                        >
                          <Star className={`h-6 w-6 transition-colors ${i <= (rHover || rRating) ? 'fill-[#f59e0b] text-[#f59e0b]' : 'fill-transparent text-[var(--al-timeline-idle)]'}`} />
                        </button>
                      ))}
                    </div>
                    <input
                      value={rName}
                      onChange={(e) => setRName(e.target.value)}
                      placeholder={t('yourName')}
                      className="neu-inset h-9 min-w-0 flex-1 rounded-xl px-3 text-xs font-bold outline-none placeholder:text-[var(--al-sand)]"
                      aria-label={t('yourName')}
                    />
                  </div>
                  <textarea
                    value={rText}
                    onChange={(e) => setRText(e.target.value)}
                    placeholder={t('reviewPh')}
                    rows={2}
                    className="neu-inset w-full rounded-xl px-3 py-2 text-xs font-medium outline-none placeholder:text-[var(--al-sand)]"
                    aria-label={t('reviewPh')}
                  />
                  {rErr && <p className="mt-1.5 text-[10px] font-bold text-red-600 dark:text-red-400">{rErr}</p>}
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <button className="rounded-full px-3 py-1.5 text-[10px] font-bold text-muted-foreground hover:text-foreground" onClick={() => setFormOpen(false)}>
                      {t('reviewCancel')}
                    </button>
                    <Button className="al-add h-9 rounded-full px-4 text-[11px] font-black" disabled={rBusy || rRating < 1 || rName.trim().length < 2 || rText.trim().length < 3} onClick={submitReview}>
                      {rBusy ? '…' : t('reviewSubmit')}
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {(revData?.reviews ?? []).map((r) => (
                  <div key={r.id} className="rounded-2xl bg-[var(--al-panel-2)] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-[11px] font-black">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--al-card)] text-[10px] shadow-sm">{r.name[0]}</span>
                        {r.name}
                        {r.source === 'BUYER' && (
                          <span className="rounded-full bg-[var(--al-chip-2)] px-1.5 py-px text-[8px] font-black uppercase tracking-wide text-[var(--al-ink-soft)]">
                            ✓ {r.orderCode ? t('verifiedBuyer') : t('community')}
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] font-bold text-[var(--al-brown)]">
                        <Stars value={r.rating} /> · {daysAgoLabel(r.createdAt, lang)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[12px] font-medium leading-relaxed text-foreground/80">“{r.comment}”</p>
                  </div>
                ))}
                {!revData && <div className="h-16 animate-pulse rounded-2xl bg-[var(--al-panel-2)]" />}
              </div>
            </div>

            {/* add bar */}
            <div className="sticky bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-[var(--al-card)] via-[var(--al-card)] pt-2">
              <div className="leading-none">
                <p className="text-[10px] font-bold text-muted-foreground">{t('youPay')}</p>
                <p className="text-xl font-black">{rs(product.priceRs * Math.max(qty, 1))}</p>
              </div>
              {qty === 0 ? (
                <Button className="al-add h-12 gap-2 rounded-full px-8 text-sm font-black" onClick={() => add(product.id)}>
                  {t('addFor')} · {product.emoji}
                </Button>
              ) : (
                <div className="al-add flex h-12 items-center gap-3 rounded-full px-3">
                  <button className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/25 hover:bg-white/40" onClick={() => decrement(product.id)} aria-label="Reduce">
                    <Minus className="h-5 w-5" />
                  </button>
                  <span className="min-w-6 text-center text-lg font-black">{qty}</span>
                  <button className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/25 hover:bg-white/40" onClick={() => add(product.id)} aria-label="Add one more">
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      )}
    </Dialog>
  )
}
