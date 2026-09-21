'use client'

// Farmer store sheet — tap any farmer name → premium profile dialog with
// their full produce list, story, KYC badge and lifetime direct earnings.

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Heart, ShieldCheck, Sprout, Star } from 'lucide-react'
import { apiGet, apiPost, fmtFollowers, rs, type Product } from '@/lib/agrilink-client'
import { makeT } from '@/lib/agrilink-i18n'
import { useAgriLink } from '@/store/agrilink'
import { ProductCard } from './product-card'

export function FarmerSheet() {
  const { lang, farmerSheetId, openFarmer, openProduct, followedFarmerIds, toggleFollow } = useAgriLink()
  const t = makeT(lang)
  const { toast } = useToast()
  const qc = useQueryClient()
  const [heartPop, setHeartPop] = useState(false)
  const { data: products } = useQuery({ queryKey: ['products', 'all'], queryFn: () => apiGet<Product[]>('/api/products') })

  const farmer = useMemo(() => products?.find((p) => p.farmer.id === farmerSheetId)?.farmer ?? null, [products, farmerSheetId])
  const theirProducts = useMemo(() => (products ?? []).filter((p) => p.farmer.id === farmerSheetId), [products, farmerSheetId])
  const following = farmerSheetId ? followedFarmerIds.includes(farmerSheetId) : false

  const onFollow = () => {
    if (!farmer) return
    const now = toggleFollow(farmer.id)
    setHeartPop(true)
    setTimeout(() => setHeartPop(false), 600)
    // Global counter — optimistic UI, server confirms in the background.
    apiPost<{ followers: number }>('/api/farmers/follow', { farmerId: farmer.id, follow: now })
      .then(() => qc.invalidateQueries({ queryKey: ['products'] }))
      .catch(() => {
        // Roll back the local state if the server rejects — stay honest.
        toggleFollow(farmer.id)
        toast({ title: t('followErr'), variant: 'destructive' })
      })
    toast({
      title: now ? `❤️ ${t('follow')} · ${farmer.name}` : `💔 ${t('unfollowToast').replace('{name}', farmer.name)}`,
      description: now ? t('followToast').replace('{name}', farmer.name) : undefined,
    })
  }

  return (
    <Dialog open={!!farmerSheetId} onOpenChange={(o) => !o && openFarmer(null)}>
      {farmer && (
        <DialogContent className="al-scroll max-h-[90vh] max-w-2xl overflow-y-auto rounded-3xl border-0 p-0">
          <DialogTitle className="sr-only">{farmer.name}</DialogTitle>
          <DialogDescription className="sr-only">
            {farmer.name} — {theirProducts.length} products from {farmer.village}
          </DialogDescription>

          {/* hero banner */}
          <div className="relative overflow-hidden bg-gradient-to-br from-[var(--al-chip-2)] via-[var(--al-mango-panel)] to-[var(--al-berry-panel)] px-5 pb-5 pt-6">
            <span className="al-float-slow pointer-events-none absolute -right-4 -top-6 text-[100px] opacity-25" aria-hidden>
              🌾
            </span>
            <div className="relative flex items-center gap-4">
              <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-[var(--al-glass-max)] text-4xl shadow-[0_10px_24px_-8px_rgba(120,92,40,0.35)]">
                {farmer.avatar}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-display flex flex-wrap items-center gap-1.5 text-2xl font-extrabold leading-tight text-[var(--al-ink)]">
                  {farmer.name}
                  {farmer.kycVerified && (
                    <span className="clay-green inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black text-[var(--al-ink-soft)]">
                      <ShieldCheck className="h-3 w-3" /> {t('verified')}
                    </span>
                  )}
                </h2>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-bold text-[var(--al-olive)]">
                  <span>📍 {farmer.village}, {farmer.district} · {farmer.state}</span>
                  <span className="flex items-center gap-0.5">
                    <Star className="h-3.5 w-3.5 fill-[#f59e0b] text-[#f59e0b]" /> {farmer.rating}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--al-glass-max)] px-2 py-0.5 text-[10px] font-black text-[#e11d48] shadow-sm dark:text-[#f9a8d4]">
                    <Heart className={`h-3 w-3 fill-current ${heartPop ? 'al-heart-pop' : ''}`} /> {fmtFollowers(farmer.followers)} {t('followers')}
                  </span>
                </p>
                <p className="mt-1 text-[11px] font-bold text-[var(--al-amber-deep)]">
                  ⚡ {rs(farmer.totalEarnedRs)} {t('lifetimeEarned')}
                </p>
              </div>
              <button
                onClick={onFollow}
                aria-pressed={following}
                aria-label={`${following ? t('following') : t('follow')} ${farmer.name}`}
                className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[11px] font-black shadow-md transition active:scale-95 ${
                  following ? 'bg-[#FBE1EE] text-[#9D174D] dark:bg-[#3d2333] dark:text-[#f9a8d4]' : 'bg-[var(--al-glass-max)] text-[var(--al-ink)] hover:bg-[var(--al-card)]'
                }`}
              >
                <Heart className={`h-4 w-4 ${heartPop ? 'al-heart-pop' : ''} ${following ? 'fill-[#e11d48] text-[#e11d48] dark:fill-[#f9a8d4] dark:text-[#f9a8d4]' : ''}`} />
                <span className="hidden sm:inline">{following ? t('following') : t('follow')}</span>
              </button>
            </div>
            <p className="relative mt-3 rounded-2xl bg-[var(--al-glass)] p-3 text-[13px] font-medium italic leading-relaxed text-[var(--al-story)]">
              “{lang === 'hi' ? farmer.storyHi : farmer.story}”
            </p>
          </div>

          {/* their produce */}
          <div className="p-4">
            <p className="mb-3 flex items-center gap-1.5 font-display text-lg font-extrabold">
              <Sprout className="h-5 w-5 text-[var(--al-green)]" /> {t('theirProduce')} ({theirProducts.length})
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {theirProducts.map((p) => (
                <div key={p.id} onClick={() => openFarmer(null)}>
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      )}
    </Dialog>
  )
}
