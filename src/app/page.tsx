'use client'

// AgriLink — farm-direct quick commerce. Single / route, view-switched:
// Market (hero → categories → grid → AI picks → how-it-works → impact) | Orders.

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence } from 'framer-motion'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { apiGet, fmtFollowers, rs, type Farmer, type Order, type Product } from '@/lib/agrilink-client'
import { makeT } from '@/lib/agrilink-i18n'
import { useAgriLink } from '@/store/agrilink'
import { AgriLinkHeader } from '@/components/agrilink/header'
import { LiveTicker } from '@/components/agrilink/ticker'
import { Hero } from '@/components/agrilink/hero'
import { CategoryBar } from '@/components/agrilink/category-bar'
import { ProductCard } from '@/components/agrilink/product-card'
import { ProductSheet } from '@/components/agrilink/product-sheet'
import { CartBar } from '@/components/agrilink/cart-bar'
import { CartSheet } from '@/components/agrilink/cart-sheet'
import { FarmerSheet } from '@/components/agrilink/farmer-sheet'
import { OrdersView } from '@/components/agrilink/orders-view'
import { AiAssistant } from '@/components/agrilink/ai-assistant'
import { HowItWorks, ImpactStrip } from '@/components/agrilink/how-it-works'
import { AgriLinkFooter } from '@/components/agrilink/footer'
import { Heart, Repeat2, Sparkles, Trophy } from 'lucide-react'

export default function AgriLinkPage() {
  const { view } = useAgriLink()

  return (
    <div className="flex min-h-screen flex-col">
      <AgriLinkHeader />
      <LiveTicker />
      <main className="flex-1 pb-6">
        {view === 'orders' ? <OrdersView /> : <MarketView />}
      </main>
      <AgriLinkFooter />
      <CartBar />
      <CartSheet />
      <FarmerSheet />
      <ProductSheet />
      <AiAssistant />
    </div>
  )
}

function MarketView() {
  const { lang, cart, buyer, pruneCart, followedFarmerIds, isFollowing, toggleFollow, openFarmer } = useAgriLink()
  const t = makeT(lang)
  const [category, setCategory] = useState('ALL')

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', 'all'],
    queryFn: () => apiGet<Product[]>('/api/products'),
  })

  // AI picks: complements for what's already in the basket
  const cartIds = cart.map((l) => l.productId).join(',')
  const { data: picks } = useQuery({
    queryKey: ['picks', cartIds],
    queryFn: () => apiGet<(Product & { why?: string })[]>(`/api/products?recs=${encodeURIComponent(cartIds)}`),
    enabled: cart.length > 0,
  })

  // Self-heal stale cart lines (product IDs changed after a reseed/delisting):
  // badge vs basket can never disagree. Deferred via setTimeout (lint-safe).
  useEffect(() => {
    if (!products || cart.length === 0) return
    const valid = products.map((p) => p.id)
    if (cart.some((l) => !valid.includes(l.productId))) {
      const id = setTimeout(() => pruneCart(valid), 0)
      return () => clearTimeout(id)
    }
  }, [products, cart, pruneCart])

  // Buy-again personalization: real order history → one-tap restock rail.
  // Blinkit-parity feature, but the story is "restock from the same farmers".
  const phone = buyer.phone.trim()
  const { data: pastOrders } = useQuery({
    queryKey: ['orders', phone],
    queryFn: () => apiGet<Order[]>(`/api/orders?phone=${encodeURIComponent(phone)}`),
    enabled: phone.length >= 6,
  })

  const buyAgain = useMemo(() => {
    if (!products || !pastOrders?.length) return []
    const score = new Map<string, number>() // productId → weighted recency×qty
    pastOrders.forEach((o, oIdx) => {
      const recency = pastOrders.length - oIdx // newest order weighs most
      for (const it of o.items) score.set(it.productId, (score.get(it.productId) ?? 0) + recency * it.qty)
    })
    return [...score.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => products.find((p) => p.id === id))
      .filter((p): p is Product => !!p && p.stockKg > 0)
      .slice(0, 8)
  }, [products, pastOrders])

  // Followed-farmers rail: freshest harvests from YOUR social graph.
  // Follows turn the catalog into a feed — social graph meets freshness.
  const followedProducts = useMemo(() => {
    if (!products || followedFarmerIds.length === 0) return []
    const mine = new Set(followedFarmerIds)
    return products
      .filter((p) => mine.has(p.farmerId) && p.stockKg > 0)
      .sort((a, b) => new Date(b.harvestedAt).getTime() - new Date(a.harvestedAt).getTime())
      .slice(0, 8)
  }, [products, followedFarmerIds])

  // Farmer leaderboard: most-loved farmers ranked by REAL server-counted
  // followers — social proof as data. Products are already farmer-embedded,
  // so this is a client-side dedupe (7 farmers over 22 products).
  const topFarmers = useMemo(() => {
    if (!products) return [] as { farmer: Farmer; productCount: number }[]
    const m = new Map<string, { farmer: Farmer; productCount: number }>()
    for (const p of products) {
      const cur = m.get(p.farmerId)
      if (cur) cur.productCount++
      else m.set(p.farmerId, { farmer: p.farmer, productCount: 1 })
    }
    return [...m.values()].sort((a, b) => b.farmer.followers - a.farmer.followers).slice(0, 4)
  }, [products])

  const filtered = useMemo(() => {
    if (!products) return []
    if (category === 'ALL') return products
    if (category === 'BESTSELLERS') return products.filter((p) => p.isBestseller)
    return products.filter((p) => p.category === category)
  }, [products, category])

  // Live counts per category chip
  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: products?.length ?? 0, BESTSELLERS: 0 }
    for (const p of products ?? []) {
      if (p.isBestseller) c.BESTSELLERS++
      c[p.category] = (c[p.category] ?? 0) + 1
    }
    return c
  }, [products])

  return (
    <>
      <Hero />

      {/* Buy again — one-tap restock from your own order history */}
      {buyAgain.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-2">
          <div className="clay clay-green p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--al-glass-strong)] shadow-sm">
                <Repeat2 className="h-4 w-4 text-[var(--al-green)]" />
              </span>
              <div>
                <h2 className="font-display text-lg font-extrabold leading-tight">🔁 {t('buyAgain')}</h2>
                <p className="text-[11px] font-semibold text-[var(--al-olive)]">{t('buyAgainSub')}</p>
              </div>
            </div>
            <div className="al-noscroll -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
              {buyAgain.map((p) => (
                <div key={p.id} className="w-40 shrink-0">
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Followed farmers — freshest picks from your social graph */}
      {followedProducts.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-2">
          <div className="clay clay-berry p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--al-glass-strong)] shadow-sm">
                <Heart className="h-4 w-4 fill-[#e11d48] text-[#e11d48]" />
              </span>
              <div>
                <h2 className="font-display text-lg font-extrabold leading-tight">🌱 {t('fromFollowed')}</h2>
                <p className="text-[11px] font-semibold text-[var(--al-ink-soft)]">{t('fromFollowedSub')}</p>
              </div>
            </div>
            <div className="al-noscroll -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
              {followedProducts.map((p) => (
                <div key={p.id} className="w-40 shrink-0">
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Farmer leaderboard — most-loved, ranked by real server followers */}
      {topFarmers.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-2">
          <div className="clay clay-mango p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--al-glass-strong)] shadow-sm">
                <Trophy className="h-4 w-4 text-[var(--al-amber-deep)]" />
              </span>
              <div>
                <h2 className="font-display text-lg font-extrabold leading-tight">🏆 {t('topFarmers')}</h2>
                <p className="text-[11px] font-semibold text-[var(--al-amber-deep)]">{t('topFarmersSub')}</p>
              </div>
            </div>
            <div className="al-noscroll -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
              {topFarmers.map(({ farmer, productCount }, i) => {
                const following = isFollowing(farmer.id)
                const medal = ['🥇', '🥈', '🥉'][i] ?? '🏅'
                return (
                  <div
                    key={farmer.id}
                    className="clay relative w-52 shrink-0 cursor-pointer rounded-2xl p-3 transition-transform hover:-translate-y-1"
                    onClick={() => openFarmer(farmer.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        openFarmer(farmer.id)
                      }
                    }}
                    aria-label={`${t('viewStore')}: ${farmer.name}`}
                  >
                    <span className="absolute -left-1.5 -top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--al-card)] text-sm shadow-md ring-1 ring-black/5" aria-hidden>
                      {medal}
                    </span>
                    <div className="flex items-center gap-2.5">
                      <span className="al-clay-emoji flex h-11 w-11 shrink-0 items-center justify-center text-2xl">{farmer.avatar}</span>
                      <div className="min-w-0 leading-tight">
                        <p className="truncate text-[13px] font-extrabold">{farmer.name}</p>
                        <p className="truncate text-[10px] font-semibold text-[var(--al-ink-soft)]">
                          📍 {farmer.village}, {farmer.state} · ⭐ {farmer.rating.toFixed(1)}
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 text-[10px] font-bold text-[var(--al-ink-soft)]">
                      ❤ {fmtFollowers(farmer.followers)} {t('followers')} · {productCount} {lang === 'hi' ? 'उपज' : 'products'}
                    </p>
                    <p className="mt-0.5 text-[10px] font-bold text-[var(--al-green)]">
                      ⚡ {rs(Math.round(farmer.totalEarnedRs))} {lang === 'hi' ? 'सीधा कमाया' : 'earned directly'}
                    </p>
                    <button
                      className={`mt-2 h-7 w-full rounded-xl text-[10px] font-black transition active:scale-95 ${following ? 'clay-green text-[var(--al-ink)]' : 'neu border-0 text-[var(--al-ink-soft)]'}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleFollow(farmer.id)
                      }}
                      aria-pressed={following}
                    >
                      {following ? `✓ ${t('following')}` : `+ ${t('follow')}`}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      <section id="shop" className="mx-auto max-w-7xl scroll-mt-24 px-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-extrabold sm:text-2xl">
            🧺 {t('categories')}
          </h2>
          <span className="flex items-center gap-1.5 rounded-full bg-[var(--al-glass)] px-2.5 py-1 text-[10px] font-extrabold text-[var(--al-ink-soft)] shadow-sm ring-1 ring-black/5">
            <span className="al-pulse-dot h-1.5 w-1.5 rounded-full bg-[#17a24f]" />
            {t('liveNow')} · {products?.length ?? 0} {lang === 'hi' ? 'उपज' : 'products'}
          </span>
        </div>
        <div className="sticky top-[64px] z-20 -mx-4 bg-[var(--al-header-strong)] px-4 py-2 backdrop-blur-md sm:top-[68px]">
          <CategoryBar value={category} onChange={setCategory} counts={counts} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {isLoading
            ? Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-3xl" />)
            : (
              <AnimatePresence mode="popLayout">
                {filtered.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </AnimatePresence>
            )}
        </div>
        {!isLoading && filtered.length === 0 && (
          <div className="clay mt-2 p-10 text-center">
            <span className="al-clay-emoji al-float inline-flex h-16 w-16 items-center justify-center text-3xl">🧺</span>
            <p className="mt-3 text-sm font-bold text-muted-foreground">{t('noResults')}</p>
            {category !== 'ALL' && (
              <Button className="al-add mt-4 rounded-full px-5 text-xs font-black" onClick={() => setCategory('ALL')}>
                {t('showAll')}
              </Button>
            )}
          </div>
        )}
      </section>

      {/* AI picks strip */}
      {cart.length > 0 && picks && picks.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-10">
          <div className="clay clay-mango p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--al-glass-strong)] shadow-sm">
                <Sparkles className="h-4 w-4 text-[var(--al-amber)]" />
              </span>
              <h2 className="font-display text-lg font-extrabold text-[var(--al-mango-ink)]">{t('popular')}</h2>
            </div>
            <div className="al-noscroll -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
              {picks.slice(0, 6).map((p) => (
                <div key={p.id} className="w-40 shrink-0">
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <HowItWorks />
      <ImpactStrip />
    </>
  )
}
