'use client'

// Floating cart bar — Blinkit-style. Appears when cart has items; sits above
// the footer on mobile & desktop. Opens the cart sheet.

import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { apiGet, finalBillFor, rs, type Product } from '@/lib/agrilink-client'
import { makeT } from '@/lib/agrilink-i18n'
import { useAgriLink } from '@/store/agrilink'

export function CartBar() {
  const { lang, cart, setCartOpen, view, promoCode, subscribed } = useAgriLink()
  const t = makeT(lang)
  const { data: products } = useQuery({ queryKey: ['products', 'all'], queryFn: () => apiGet<Product[]>('/api/products') })

  const lines = cart
    .map((l) => ({ line: l, product: products?.find((p) => p.id === l.productId) }))
    .filter((x): x is { line: typeof cart[number]; product: Product } => !!x.product)
  const itemsTotal = lines.reduce((s, x) => s + x.product.priceRs * x.line.qty, 0)
  const count = lines.reduce((s, x) => s + x.line.qty, 0)
  // Promo- + subscription-aware final bill — the floating bar never shows a
  // stale pre-discount number; farmer payout stays itemsTotal (all discounts
  // are platform-subsidized).
  const bill = finalBillFor(itemsTotal, promoCode, subscribed ? 'WEEKLY' : null)
  const totalDiscount = bill.discountRs + bill.subDiscountRs
  const farmersCount = new Set(lines.map((x) => x.product.farmerId)).size

  return (
    <AnimatePresence>
      {count > 0 && view === 'market' && (
        <motion.div
          initial={{ y: 90, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 90, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 24 }}
          className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-3"
        >
          <button
            className="al-add pointer-events-auto flex w-full max-w-xl items-center gap-3 rounded-2xl px-4 py-3 text-left shadow-2xl transition-transform active:scale-[0.98]"
            onClick={() => setCartOpen(true)}
            aria-label={`${t('yourCart')} — ${rs(bill.totalRs)}`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/25 text-lg">
              🧺
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="flex items-center gap-2 text-sm font-black">
                {count} {t('items').toLowerCase()} · {rs(bill.totalRs)}
                {totalDiscount > 0 && (
                  <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide">
                    {promoCode ?? (subscribed ? 'WEEKLY' : '')} −{rs(totalDiscount)}
                  </span>
                )}
              </span>
              <span className="block text-[11px] font-semibold text-white/85">
                {farmersCount} {lang === 'hi' ? 'किसान को तुरंत भुगतान होगा' : farmersCount === 1 ? 'farmer paid instantly' : 'farmers paid instantly'}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1 rounded-xl bg-white/20 px-3 py-2 text-xs font-black">
              {t('cart')} <ChevronRight className="h-4 w-4" />
            </span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
