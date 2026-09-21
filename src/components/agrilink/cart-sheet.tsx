'use client'

// Cart sheet — items → delivery details → UPI pay → SUCCESS with instant
// payout proofs per farmer (the zero-middleman wow moment).

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BadgePercent, CalendarClock, Clock, Download, HandCoins, MapPin, Minus, Plus, Repeat, ShieldCheck, Share2, Sparkles, Ticket, Trash2, Wallet, Zap } from 'lucide-react'
import { apiDelete, apiGet, apiPost, couponErrorFor, couponList, DELIVERY_SLOTS, finalBillFor, FREE_ABOVE, PROMOS, promoDiscountFor, rs, slotLabel, subDiscountFor, TIP_OPTIONS, type AddressT, type Order, type Product, type WalletResponse } from '@/lib/agrilink-client'
import { makeT } from '@/lib/agrilink-i18n'
import { useAgriLink } from '@/store/agrilink'
import { useToast } from '@/hooks/use-toast'

type PayoutProof = { farmerName: string; farmerAvatar: string; amountRs: number; payoutRef: string; upiId: string }
type PayResponse = { order: Order; payouts: PayoutProof[]; discountRs: number; subDiscountRs: number; walletUsedRs: number; tipRs: number }

// Deterministic confetti field for the success step (client-only render, but
// stable values keep React quiet and the motion reduced-friendly).
const CONFETTI = ['🥭', '🍅', '🥬', '₹', '🌿', '🥕', '💸', '🧅', '₹', '🫑', '🥔', '🌾', '🍌', '₹', '🥗', '✨'].map((c, i) => ({
  char: c,
  left: 4 + ((i * 61) % 93), // 4–97%
  drift: ((i * 37) % 60) - 30, // -30..30px
  delay: (i % 8) * 0.14,
  dur: 2 + ((i * 13) % 9) / 10,
  spin: 360 + ((i * 97) % 480),
  size: 13 + ((i * 7) % 10),
}))

export function CartSheet() {
  const { lang, cart, cartOpen, setCartOpen, add, decrement, removeLine, clearCart, buyer, setBuyer, setView, promoCode, setPromoCode, slotKey, setSlotKey, subscribed, setSubscribed } = useAgriLink()
  const t = makeT(lang)
  const qc = useQueryClient()
  const { toast } = useToast()
  const { data: products } = useQuery({ queryKey: ['products', 'all'], queryFn: () => apiGet<Product[]>('/api/products') })
  const [step, setStep] = useState<'cart' | 'details' | 'paying' | 'success'>('cart')
  const [result, setResult] = useState<PayResponse | null>(null)
  const [form, setForm] = useState(buyer)
  const [error, setError] = useState('')
  const [promoInput, setPromoInput] = useState('')
  const [promoMsg, setPromoMsg] = useState<string | null>(null)
  const [tipRs, setTipRs] = useState(0)
  const [useWallet, setUseWallet] = useState(false)
  const [saveAddr, setSaveAddr] = useState(false)

  const phone = buyer.phone.trim()
  // While the buyer types their phone at checkout, look up THEIR wallet and
  // saved addresses live — the moment a valid number is in, one-tap magic is
  // available (no store-write needed).
  const lookupPhone = form.phone.trim().length >= 6 ? form.phone.trim() : phone
  // Wallet — refunds + referral credits, spendable at checkout.
  const { data: wallet } = useQuery({
    queryKey: ['wallet', lookupPhone],
    queryFn: () => apiGet<WalletResponse>(`/api/wallet?phone=${encodeURIComponent(lookupPhone)}`),
    enabled: lookupPhone.length >= 6,
  })
  const walletBalance = Math.max(0, Math.floor(wallet?.balanceRs ?? 0))
  // Saved addresses — pick instead of retyping.
  const { data: savedAddresses } = useQuery({
    queryKey: ['addresses', lookupPhone],
    queryFn: () => apiGet<AddressT[]>(`/api/addresses?phone=${encodeURIComponent(lookupPhone)}`),
    enabled: lookupPhone.length >= 6,
  })

  const lines = useMemo(
    () =>
      cart
        .map((l) => ({ line: l, product: products?.find((p) => p.id === l.productId) }))
        .filter((x): x is { line: typeof cart[number]; product: Product } => !!x.product),
    [cart, products]
  )
  const itemsTotal = lines.reduce((s, x) => s + x.product.priceRs * x.line.qty, 0)
  const bill = finalBillFor(itemsTotal, promoCode, subscribed ? 'WEEKLY' : null, tipRs)
  const walletApplied = useWallet && walletBalance > 0 ? Math.min(walletBalance, bill.totalRs) : 0
  const grandTotal = bill.totalRs - walletApplied
  const subDiscountRs = subscribed ? subDiscountFor('WEEKLY', itemsTotal) : 0
  const toFree = Math.max(0, FREE_ABOVE - itemsTotal)
  const farmerMap = useMemo(() => {
    const m = new Map<string, { name: string; avatar: string; amount: number; upiId: string }>()
    for (const x of lines) {
      const cur = m.get(x.product.farmerId) ?? { name: x.product.farmer.name, avatar: x.product.farmer.avatar, amount: 0, upiId: x.product.farmer.upiId }
      cur.amount += x.product.priceRs * x.line.qty
      m.set(x.product.farmerId, cur)
    }
    return m
  }, [lines])

  const canPay = form.name.trim().length >= 2 && /^\+?\d{10,13}$/.test(form.phone.replace(/\s/g, '')) && form.address.trim().length >= 6

  const pay = async () => {
    if (!canPay) return
    setStep('paying')
    setError('')
    try {
      // Optionally persist the typed address for one-tap reuse next time.
      if (saveAddr && form.address.trim().length >= 6) {
        try {
          await apiPost('/api/addresses', {
            phone: form.phone.trim(),
            label: 'Home',
            receiver: form.name.trim(),
            line: form.address.trim(),
            city: form.city.trim() || 'Pune',
          })
          setSaveAddr(false)
          qc.invalidateQueries({ queryKey: ['addresses'] })
        } catch {
          /* saving is a convenience — never block payment on it */
        }
      }
      setBuyer(form)
      const res = await apiPost<PayResponse>('/api/orders', {
        buyerName: form.name.trim(),
        buyerPhone: form.phone.trim(),
        buyerCity: form.city.trim() || 'Pune',
        address: form.address.trim(),
        promoCode: promoCode ?? undefined,
        slotKey,
        subscription: subscribed ? 'WEEKLY' : undefined,
        tipRs,
        useWallet: walletApplied > 0,
        items: cart.map((l) => ({ productId: l.productId, qty: l.qty })),
      })
      setResult(res)
      clearCart()
      setPromoCode(null) // promo consumed by this order
      setTipRs(0)
      setUseWallet(false)
      setStep('success')
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      qc.invalidateQueries({ queryKey: ['wallet'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['orders'] })
      if (res.walletUsedRs > 0) toast({ title: t('walletSavedToast').replace('{n}', String(res.walletUsedRs)).replace('{m}', String(Math.round(res.order.totalRs))) })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment failed')
      setStep('details')
    }
  }

  const close = (o: boolean) => {
    if (!o) {
      setCartOpen(false)
      if (step === 'success') {
        setStep('cart')
        setResult(null)
        setView('orders')
      }
    }
  }

  // Share/copy the receipt — proof of the zero-middleman promise, shareable.
  const shareReceipt = async () => {
    if (!result) return
    const payoutLines = result.payouts.map((p) => `${p.farmerAvatar} ${p.farmerName} → ₹${Math.round(p.amountRs)} (${p.payoutRef})`).join('\n')
    const text = `🌾 AgriLink — ${result.order.code}\nPaid ${rs(result.order.totalRs)} via UPI\n\nFarmers paid instantly:\n${payoutLines}\n\n100% chemical-free · zero middlemen · every rupee reached the farm.`
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: 'AgriLink receipt', text })
      } else {
        await navigator.clipboard.writeText(text)
        toast({ title: t('receiptCopied') })
      }
    } catch {
      // Share sheet cancelled (AbortError) or clipboard blocked — stay silent,
      // never punish a user for closing their own share dialog.
    }
  }

  // Receipt as image — canvas-rendered PNG, no deps. Perfect for WhatsApp
  // status / Instagram stories: free marketing that proves farmers got paid.
  const saveReceiptImage = async () => {
    if (!result) return
    const W = 640
    const PAD = 28
    const rowH = 56
    const H =
      270 +
      result.payouts.length * rowH +
      (result.discountRs > 0 ? 34 : 0) +
      (result.order.subscription ? 34 : 0) +
      ((result.order.tipRs ?? 0) > 0 ? 34 : 0) +
      ((result.order.walletUsedRs ?? 0) > 0 ? 34 : 0)
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const g = c.getContext('2d')
    if (!g) return
    // cream card + rounded corners
    g.fillStyle = '#FFFBF2'
    g.beginPath()
    g.roundRect(0, 0, W, H, 24)
    g.fill()
    // header band
    g.fillStyle = '#17a24f'
    g.beginPath()
    g.roundRect(0, 0, W, 92, { topLeft: 24, topRight: 24, bottomLeft: 0, bottomRight: 0 } as DOMRectInit)
    g.fill()
    g.fillStyle = '#ffffff'
    g.font = '900 34px system-ui, sans-serif'
    g.fillText('🌿 AgriLink', PAD, 44)
    g.font = '700 15px system-ui, sans-serif'
    g.fillText(lang === 'hi' ? 'किसान से सीधा · शून्य बिचौलिए' : 'Farmer-direct · Zero middlemen', PAD, 70)
    g.font = '900 20px system-ui, sans-serif'
    g.textAlign = 'right'
    g.fillText(result.order.code, W - PAD, 44)
    g.font = '700 13px system-ui, sans-serif'
    g.fillText(new Date(result.order.createdAt).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' }), W - PAD, 70)
    g.textAlign = 'left'
    // paid line
    g.fillStyle = '#1a2e22'
    g.font = '900 22px system-ui, sans-serif'
    g.fillText(`${lang === 'hi' ? 'UPI से भुगतान' : 'Paid via UPI'}  ₹${Math.round(result.order.totalRs).toLocaleString('en-IN')}`, PAD, 138)
    g.fillStyle = '#6b7a6f'
    g.font = '700 13px system-ui, sans-serif'
    g.fillText(lang === 'hi' ? 'हर किसान को तुरंत पैसा मिला — प्रमाण:' : 'Every farmer was paid instantly — proof:', PAD, 162)
    // payout rows
    let y = 196
    for (const p of result.payouts) {
      g.fillStyle = '#ffffff'
      g.beginPath()
      g.roundRect(PAD, y - 34, W - PAD * 2, rowH - 10, 14)
      g.fill()
      g.strokeStyle = 'rgba(23,162,79,0.18)'
      g.stroke()
      g.font = '22px system-ui, sans-serif'
      g.fillText(p.farmerAvatar, PAD + 12, y)
      g.fillStyle = '#1a2e22'
      g.font = '800 16px system-ui, sans-serif'
      g.fillText(`${p.farmerName}  ₹${Math.round(p.amountRs).toLocaleString('en-IN')}`, PAD + 52, y - 8)
      g.fillStyle = '#7a8a7f'
      g.font = '600 11px ui-monospace, monospace'
      g.fillText(`${p.upiId} · ${p.payoutRef}`, PAD + 52, y + 12)
      g.fillStyle = '#17a24f'
      g.font = '900 18px system-ui, sans-serif'
      g.textAlign = 'right'
      g.fillText('✓', W - PAD - 10, y - 2)
      g.textAlign = 'left'
      y += rowH
    }
    if (result.discountRs > 0) {
      g.fillStyle = '#17a24f'
      g.font = '800 13px system-ui, sans-serif'
      g.fillText(`🎉 ${result.order.promoCode ?? 'PROMO'} −₹${Math.round(result.discountRs)} · ${lang === 'hi' ? 'छूट हमारी — किसान को 100%' : 'discount on us — farmer still gets 100%'}`, PAD, y - 8)
      y += 34
    }
    if (result.order.subscription) {
      g.fillStyle = '#9A3412'
      g.font = '800 13px system-ui, sans-serif'
      g.fillText(`🔁 ${t('subReceipt')} — ${t('subNext')} ${result.order.nextDeliveryAt ? new Date(result.order.nextDeliveryAt).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { dateStyle: 'medium' }) : ''}`, PAD, y - 8)
      y += 34
    }
    if ((result.order.tipRs ?? 0) > 0) {
      g.fillStyle = '#6b7a6f'
      g.font = '800 13px system-ui, sans-serif'
      g.fillText(`🛵 ${t('tipLine')}: ₹${Math.round(result.order.tipRs)} (${lang === 'hi' ? '100% राइडर को' : '100% to the rider'})`, PAD, y - 8)
      y += 34
    }
    if ((result.order.walletUsedRs ?? 0) > 0) {
      g.fillStyle = '#17a24f'
      g.font = '800 13px system-ui, sans-serif'
      g.fillText(`👛 ${t('walletLine').replace('{n}', String(result.order.walletUsedRs))}`, PAD, y - 8)
      y += 34
    }
    // footer
    g.fillStyle = '#17a24f'
    g.font = '900 15px system-ui, sans-serif'
    g.textAlign = 'center'
    g.fillText(lang === 'hi' ? '100% केमिकल-फ़्री · शून्य बिचौलिए · हर रुपया खेत तक' : '100% chemical-free · zero middlemen · every rupee reached the farm', W / 2, H - 34)
    g.fillStyle = '#9aa89f'
    g.font = '700 10px system-ui, sans-serif'
    g.fillText('AgriLink · mock Razorpay X payout proof · demo', W / 2, H - 14)
    g.textAlign = 'left'
    // download
    try {
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'))
      if (blob) {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `AgriLink-${result.order.code}.png`
        a.click()
        URL.revokeObjectURL(url)
        toast({ title: t('imageSaved') })
      }
    } catch {
      // download blocked (headless/permissions) — stay silent like share
    }
  }

  return (
    <Dialog open={cartOpen} onOpenChange={close}>
      <DialogContent className="al-scroll max-h-[90vh] max-w-md overflow-y-auto rounded-3xl border-0 p-0">
        <DialogTitle className="sr-only">{t('yourCart')}</DialogTitle>
        <DialogDescription className="sr-only">Review your basket and pay — every farmer is paid instantly.</DialogDescription>

        {/* ═══ CART STEP ═══ */}
        {step === 'cart' && (
          <div className="p-4">
            <h2 className="font-display text-xl font-extrabold">🧺 {t('yourCart')}</h2>
            {lines.length === 0 ? (
              <div className="py-12 text-center">
                <span className="al-clay-emoji al-float inline-flex h-20 w-20 items-center justify-center rounded-full text-5xl">🥕</span>
                <p className="mt-3 text-sm font-bold text-muted-foreground">{t('emptyCart')}</p>
                <Button className="al-add mt-4 rounded-full px-6 text-xs font-black" onClick={() => close(false)}>
                  {t('browseFarm')}
                </Button>
              </div>
            ) : (
              <>
                <div className="mt-3 space-y-2">
                  {lines.map(({ line, product }) => (
                    <div key={product.id} className="clay flex items-center gap-2.5 rounded-2xl p-2.5">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--al-panel-3)] text-xl">{product.emoji}</span>
                      <div className="min-w-0 flex-1 leading-tight">
                        <p className="truncate text-[13px] font-extrabold">{lang === 'hi' ? product.nameHi : product.name}</p>
                        <p className="truncate text-[10px] font-semibold text-muted-foreground">
                          {product.unitLabel} · {product.farmer.avatar} {product.farmer.name}
                        </p>
                      </div>
                      <div className="al-add flex h-8 items-center gap-1.5 rounded-xl px-1">
                        <button className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/25 hover:bg-white/40" onClick={() => decrement(product.id)} aria-label="Reduce">
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-4 text-center text-xs font-black">{line.qty}</span>
                        <button className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/25 hover:bg-white/40" onClick={() => add(product.id)} aria-label="Add one more">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="w-14 text-right text-[13px] font-black">{rs(product.priceRs * line.qty)}</div>
                      <button className="text-muted-foreground/50 transition hover:text-red-500" onClick={() => removeLine(product.id)} aria-label={`${t('remove')} ${product.name}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* instant payout preview */}
                <div className="clay-green mt-3 rounded-2xl p-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-[var(--al-ink)]">
                    <Zap className="h-3.5 w-3.5" /> {t('farmersGet')} — {rs(itemsTotal)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[...farmerMap.values()].map((f) => (
                      <span key={f.name} className="rounded-full bg-[var(--al-glass)] px-2 py-1 text-[10px] font-bold text-[var(--al-ink-soft)]">
                        {f.avatar} {f.name.split(' ')[0]} → {rs(f.amount)}
                      </span>
                    ))}
                  </div>
                </div>

                {/* free delivery progress */}
                <div className="rounded-2xl bg-[var(--al-mango-panel-2)] p-2.5">
                  {bill.deliveryFeeRs === 0 ? (
                    <p className="text-center text-[11px] font-black text-[var(--al-ink-soft)]">{t('freeUnlocked')}</p>
                  ) : (
                    <>
                      <p className="mb-1 text-center text-[11px] font-bold text-[var(--al-amber-deep)]">{t('freeDeliveryProgress').replace('{n}', rs(toFree))}</p>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--al-inset)]">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#f59e0b] to-[#84cc16] transition-all" style={{ width: `${Math.min(100, (itemsTotal / FREE_ABOVE) * 100)}%` }} />
                      </div>
                    </>
                  )}
                </div>

                {/* promo */}
                <div className="flex items-center gap-2">
                  <div className="neu-inset flex flex-1 items-center gap-1.5 rounded-xl px-3 py-2">
                    <BadgePercent className="h-4 w-4 shrink-0 text-[var(--al-amber)]" />
                    <input
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                      placeholder={t('promoPh')}
                      className="min-w-0 flex-1 bg-transparent text-xs font-bold outline-none placeholder:text-[var(--al-sand)]"
                      aria-label={t('promoPh')}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="neu h-9 rounded-xl border-0 px-4 text-xs font-extrabold"
                    onClick={() => {
                      const key = promoInput.trim().toUpperCase()
                      if (!key) {
                        setPromoCode(null)
                        setPromoMsg(null)
                        return
                      }
                      const err = couponErrorFor(key, itemsTotal, lang)
                      if (!err && PROMOS[key]) {
                        setPromoCode(key)
                        setPromoMsg(`${t('couponSaved').replace('{code}', key).replace('{n}', String(promoDiscountFor(key, itemsTotal)))} · ${t('promoNote')}`)
                      } else {
                        setPromoCode(null)
                        setPromoMsg(err ?? t('promoBad'))
                      }
                    }}
                  >
                    {t('promoApply')}
                  </Button>
                </div>
                {promoMsg && (
                  <p className={`text-[10px] font-bold ${promoCode ? 'text-[var(--al-ink-soft)]' : 'text-red-600 dark:text-red-400'}`}>
                    {promoMsg}
                  </p>
                )}

                {/* coupon book — one-tap apply chips (server-validated at pay time) */}
                <div className="mt-1.5">
                  <p className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                    <Ticket className="h-3 w-3 text-[var(--al-amber)]" /> {t('couponsTitle')}
                  </p>
                  <div className="al-noscroll -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                    {couponList().map((c) => {
                      const active = promoCode === c.code
                      const locked = itemsTotal < c.min
                      return (
                        <button
                          key={c.code}
                          role="checkbox"
                          aria-checked={active}
                          onClick={() => {
                            if (active) {
                              setPromoCode(null)
                              setPromoMsg(t('couponRemoved'))
                            } else if (locked) {
                              setPromoCode(null)
                              setPromoMsg(t('couponMinErr').replace('{min}', String(c.min)).replace('{need}', String(Math.ceil(c.min - itemsTotal))))
                            } else {
                              setPromoCode(c.code)
                              setPromoMsg(t('couponSaved').replace('{code}', c.code).replace('{n}', String(promoDiscountFor(c.code, itemsTotal))))
                            }
                          }}
                          className={`w-44 shrink-0 rounded-2xl p-2.5 text-left transition-all ${active ? 'clay-green shadow-md' : locked ? 'neu border-0 opacity-60' : 'clay hover:-translate-y-0.5'}`}
                        >
                          <p className="flex items-center justify-between text-[11px] font-black text-[var(--al-ink)]">
                            {c.code} {active ? '✓' : '🎟️'}
                          </p>
                          <p className="text-[9px] font-bold leading-tight text-[var(--al-ink-soft)]">{lang === 'hi' ? c.hi : c.en}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* bill */}
                <div className="mt-1 space-y-1.5 rounded-2xl bg-[var(--al-panel-2)] p-3 text-xs font-semibold">
                  <div className="flex justify-between text-foreground/75">
                    <span>{t('itemTotal')}</span>
                    <span>{rs(bill.itemsTotal)}</span>
                  </div>
                  {bill.discountRs > 0 && (
                    <div className="flex justify-between font-black text-[var(--al-green)]">
                      <span>{promoCode} 🎉</span>
                      <span>−{rs(bill.discountRs)}</span>
                    </div>
                  )}
                  {subDiscountRs > 0 && (
                    <div className="flex justify-between font-black text-[var(--al-green)]">
                      <span>🔁 {t('subLine')} 🎉</span>
                      <span>−{rs(subDiscountRs)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-foreground/75">
                    <span>{t('deliveryFee')}</span>
                    <span className={bill.deliveryFeeRs === 0 ? 'font-black text-[var(--al-green)]' : ''}>{bill.deliveryFeeRs === 0 ? t('free') : rs(bill.deliveryFeeRs)}</span>
                  </div>
                  {bill.deliveryFeeRs > 0 && <p className="text-[10px] font-bold text-[var(--al-amber)]">Add {rs(FREE_ABOVE - itemsTotal)} more for FREE delivery</p>}
                  <div className="flex justify-between text-foreground/75">
                    <span>{t('platformFee')}</span>
                    <span>{rs(bill.platformFeeRs)}</span>
                  </div>
                  {bill.tipRs > 0 && (
                    <div className="flex justify-between text-foreground/75">
                      <span>{t('tipLine')}</span>
                      <span>{rs(bill.tipRs)}</span>
                    </div>
                  )}
                  {walletApplied > 0 && (
                    <div className="flex justify-between font-black text-[var(--al-green)]">
                      <span>👛 {t('walletLine').replace('{n}', String(walletApplied))}</span>
                      <span>−{rs(walletApplied)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-dashed pt-1.5 text-sm font-black text-foreground">
                    <span>{t('toPay')}</span>
                    <span>{rs(grandTotal)}</span>
                  </div>
                </div>

                <Button
                  className="al-add mt-3 h-12 w-full gap-2 rounded-2xl text-sm font-black"
                  onClick={() => {
                    // Adopt the persisted buyer if the form is untouched — the
                    // store hydrates after mount, so useState(buyer) may be stale.
                    setForm((f) => (f.name || f.phone || f.address ? f : buyer))
                    setStep('details')
                  }}
                >
                  <Zap className="h-4 w-4" /> {t('payNow')} · {rs(grandTotal)}
                </Button>
              </>
            )}
          </div>
        )}

        {/* ═══ DETAILS STEP ═══ */}
        {step === 'details' && (
          <div className="p-4">
            <button className="mb-2 text-xs font-bold text-muted-foreground hover:text-foreground" onClick={() => setStep('cart')}>
              ← {t('yourCart')}
            </button>
            <h2 className="font-display text-xl font-extrabold">📍 {t('deliverTo')}</h2>

            {/* saved addresses — one tap fills the form (Blinkit-parity) */}
            {(savedAddresses ?? []).length > 0 && (
              <div className="mt-2">
                <p className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                  <MapPin className="h-3 w-3 text-[var(--al-green)]" /> {t('savedAddresses')}
                </p>
                <div className="al-noscroll -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  {(savedAddresses ?? []).map((a) => {
                    const active = form.address.trim() === a.line
                    return (
                      <div key={a.id} className={`w-48 shrink-0 rounded-2xl p-2.5 transition-all ${active ? 'clay-green shadow-md' : 'neu border-0 hover:-translate-y-0.5'}`}>
                        <p className="flex items-center justify-between text-[11px] font-black">
                          <span>{a.label === 'Home' ? '🏠' : a.label === 'Work' ? '💼' : '📍'} {a.label}{a.isDefault ? ' · ⭐' : ''}</span>
                          <button
                            className="text-[9px] font-bold text-muted-foreground/60 transition hover:text-red-500"
                            onClick={async () => {
                              try {
                                await apiDelete(`/api/addresses?id=${a.id}&phone=${encodeURIComponent(lookupPhone)}`)
                                qc.invalidateQueries({ queryKey: ['addresses', lookupPhone] })
                                toast({ title: t('addrDeleted') })
                              } catch {
                                /* ignore */
                              }
                            }}
                            aria-label={`${t('addrDelete')} ${a.label}`}
                          >
                            ✕
                          </button>
                        </p>
                        <button className="mt-0.5 block w-full text-left" onClick={() => setForm({ ...form, name: a.receiver, address: a.line, city: a.city })}>
                          <span className="line-clamp-2 block text-[10px] font-semibold text-[var(--al-ink-soft)]">{a.line}</span>
                          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-black ${active ? 'bg-white/40 text-[var(--al-ink)]' : 'bg-[var(--al-chip-2)] text-[var(--al-ink-soft)]'}`}>
                            {active ? `✓ ${t('addrUsing')}` : t('addrUse')}
                          </span>
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="mt-3 space-y-2.5">
              <Input className="neu-inset h-11 rounded-xl border-0 text-sm font-semibold shadow-none" placeholder={t('name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-label={t('name')} />
              <Input className="neu-inset h-11 rounded-xl border-0 text-sm font-semibold shadow-none" placeholder={t('phone') + ' e.g. 9876543210'} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" aria-label={t('phone')} />
              <Input className="neu-inset h-11 rounded-xl border-0 text-sm font-semibold shadow-none" placeholder={t('city')} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} aria-label={t('city')} />
              <textarea
                className="neu-inset w-full rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none placeholder:text-[var(--al-sand)]"
                placeholder={t('address')}
                rows={2}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                aria-label={t('address')}
              />
            </div>
            {error && <p className="mt-2 rounded-xl bg-red-50 p-2 text-xs font-bold text-red-600 dark:bg-red-950/60 dark:text-red-400">{error}</p>}

            {/* save this address for one-tap reuse */}
            {form.address.trim().length >= 6 && !(savedAddresses ?? []).some((a) => a.line === form.address.trim()) && (
              <button
                role="checkbox"
                aria-checked={saveAddr}
                onClick={() => setSaveAddr(!saveAddr)}
                className="mt-1.5 flex items-center gap-2 text-left"
              >
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-black transition-all ${saveAddr ? 'bg-[#17a24f] text-white shadow' : 'neu border-0 text-transparent'}`} aria-hidden>
                  ✓
                </span>
                <span className="text-[11px] font-bold text-[var(--al-ink-soft)]">🏠 {t('saveAddress')}</span>
              </button>
            )}

            {/* delivery slot — Express now, or schedule a window (Blinkit-parity) */}
            <div className="mt-3">
              <p className="mb-1.5 flex items-center gap-1 text-[11px] font-black uppercase tracking-wide text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> {t('slotTitle')}
              </p>
              <div className="al-noscroll -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label={t('slotTitle')}>
                {DELIVERY_SLOTS.map((s) => {
                  const active = slotKey === s.key
                  return (
                    <button
                      key={s.key}
                      role="radio"
                      aria-checked={active}
                      onClick={() => setSlotKey(s.key)}
                      className={`flex shrink-0 items-center gap-1.5 rounded-2xl px-3 py-2 text-[11px] font-extrabold transition-all ${
                        active ? 'al-add shadow-md' : 'neu border-0 text-[var(--al-ink-soft)] hover:-translate-y-0.5'
                      }`}
                    >
                      <span aria-hidden>{s.emoji}</span> {lang === 'hi' ? s.hi : s.en}
                    </button>
                  )
                })}
              </div>
              {slotKey !== 'EXPRESS' && <p className="mt-1 text-[10px] font-bold text-[var(--al-amber-deep)]">🧑‍🌾 {t('slotNote')}</p>}
            </div>

            {/* delivery-partner tip — 100% pass-through to the rider */}
            <div className="mt-3">
              <p className="mb-1.5 flex items-center gap-1 text-[11px] font-black uppercase tracking-wide text-muted-foreground">
                <HandCoins className="h-3.5 w-3.5 text-[var(--al-amber)]" /> {t('tipTitle')}
              </p>
              <div className="flex gap-2" role="radiogroup" aria-label={t('tipTitle')}>
                {[0, ...TIP_OPTIONS].map((v) => {
                  const active = tipRs === v
                  return (
                    <button
                      key={v}
                      role="radio"
                      aria-checked={active}
                      onClick={() => setTipRs(v)}
                      className={`flex h-9 flex-1 items-center justify-center gap-1 rounded-xl text-[11px] font-extrabold transition-all ${
                        active ? 'al-add shadow-md' : 'neu border-0 text-[var(--al-ink-soft)] hover:-translate-y-0.5'
                      }`}
                    >
                      {v === 0 ? t('tipNone') : `₹${v}`}
                    </button>
                  )
                })}
              </div>
              <p className="mt-1 text-[10px] font-semibold text-[var(--al-ink-soft)]">🛵 {t('tipSub')}</p>
            </div>

            {/* wallet — refunds + referral credits, one toggle away */}
            {walletBalance > 0 && (
              <button
                role="checkbox"
                aria-checked={useWallet}
                onClick={() => setUseWallet(!useWallet)}
                className={`mt-3 flex w-full items-center gap-2.5 rounded-2xl p-3 text-left transition-all ${useWallet ? 'clay-green shadow-md' : 'neu border-0 hover:-translate-y-0.5'}`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${useWallet ? 'bg-white/30' : 'bg-[var(--al-glass)]'}`}>
                  <Wallet className={`h-4 w-4 ${useWallet ? 'text-[var(--al-ink)]' : 'text-[var(--al-green)]'}`} />
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block text-[12px] font-black text-[var(--al-ink)]">👛 {t('walletUse')}</span>
                  <span className="block text-[10px] font-semibold text-[var(--al-ink-soft)]">
                    {t('walletBalance')}: <span className="font-black text-[var(--al-green)]">{rs(walletBalance)}</span>
                    {useWallet && walletApplied > 0 && <> · {t('walletLine').replace('{n}', String(walletApplied))}</>}
                  </span>
                </span>
                <span
                  className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-all ${useWallet ? 'translate-x-0 justify-end bg-[#17a24f]' : 'justify-start bg-[var(--al-inset)]'}`}
                  aria-hidden
                >
                  <span className="al-pop h-4 w-4 rounded-full bg-white shadow-sm" />
                </span>
              </button>
            )}

            {/* weekly basket subscription — 5% off every week, cancel anytime */}
            <button
              role="checkbox"
              aria-checked={subscribed}
              onClick={() => setSubscribed(!subscribed)}
              className={`mt-3 flex w-full items-center gap-2.5 rounded-2xl p-3 text-left transition-all ${subscribed ? 'clay-green shadow-md' : 'neu border-0 hover:-translate-y-0.5'}`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${subscribed ? 'bg-white/30' : 'bg-[var(--al-glass)]'}`}>
                <Repeat className={`h-4 w-4 ${subscribed ? 'text-[var(--al-ink)]' : 'text-[var(--al-green)]'}`} />
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="flex items-center gap-1.5 text-[12px] font-black text-[var(--al-ink)]">
                  🔁 {t('subToggle')}
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${subscribed ? 'bg-white/40 text-[var(--al-ink)]' : 'bg-[var(--al-mango-panel)] text-[var(--al-amber-deep)]'}`}>
                    −5%
                  </span>
                </span>
                <span className="block text-[10px] font-semibold text-[var(--al-ink-soft)]">{t('subToggleSub')}</span>
              </span>
              <span
                className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-all ${subscribed ? 'translate-x-0 justify-end bg-[#17a24f]' : 'justify-start bg-[var(--al-inset)]'}`}
                aria-hidden
              >
                <span className="al-pop h-4 w-4 rounded-full bg-white shadow-sm" />
              </span>
            </button>

            <div className="clay-mango mt-3 flex items-center gap-2 rounded-2xl p-3 text-[11px] font-bold text-[var(--al-amber-deep)]">
              <ShieldCheck className="h-4 w-4 shrink-0" /> {t('trustInstant')} — {t('farmersGet')} {rs(itemsTotal)}
            </div>
            <Button className="al-add mt-3 h-12 w-full gap-2 rounded-2xl text-sm font-black" disabled={!canPay} onClick={pay}>
              <Zap className="h-4 w-4" /> {t('payNow')} · {rs(grandTotal)}
            </Button>
          </div>
        )}

        {/* ═══ PAYING STEP ═══ */}
        {step === 'paying' && (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="neu flex h-20 w-20 items-center justify-center rounded-full">
              <span className="al-float text-4xl">💸</span>
            </div>
            <p className="mt-4 font-display text-lg font-extrabold">{t('paying')}</p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">UPI · {rs(grandTotal)}</p>
            <div className="mt-4 h-1.5 w-40 overflow-hidden rounded-full bg-[var(--al-inset)]">
              <div className="al-shimmer h-full w-full rounded-full bg-[#17a24f]/40" />
            </div>
          </div>
        )}

        {/* ═══ SUCCESS STEP ═══ */}
        {step === 'success' && result && (
          <div className="relative overflow-hidden p-4">
            {/* clay confetti — tiny, 2G-friendly, reduced-motion aware */}
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
              {CONFETTI.map((c, i) => (
                <span
                  key={i}
                  className="al-confetti"
                  style={{
                    left: `${c.left}%`,
                    fontSize: c.size,
                    ['--drift' as string]: `${c.drift}px`,
                    ['--delay' as string]: `${c.delay}s`,
                    ['--dur' as string]: `${c.dur}s`,
                    ['--spin' as string]: `${c.spin}deg`,
                  }}
                >
                  {c.char}
                </span>
              ))}
            </div>
            <div className="text-center">
              <span className="al-pop inline-flex h-16 w-16 items-center justify-center rounded-full bg-[var(--al-chip-2)] text-4xl shadow-inner">✅</span>
              <h2 className="mt-2 font-display text-xl font-extrabold text-[var(--al-ink)]">{t('orderPlaced')}</h2>
              <p className="text-xs font-bold text-muted-foreground">
                {t('orderCode')} {result.order.code} · {t('eta')} ~{result.order.etaMin} min
              </p>
              <p className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-[var(--al-mango-panel)] px-2.5 py-1 text-[11px] font-extrabold text-[var(--al-amber-deep)]">
                🛵 {slotLabel(result.order.slotKey, lang)}
              </p>
              {result.order.subscription && (
                <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-[var(--al-chip-2)] px-2.5 py-1 text-[11px] font-extrabold text-[var(--al-ink-soft)] ring-1 ring-[var(--al-green)]/25">
                  <CalendarClock className="h-3.5 w-3.5 text-[var(--al-green)]" />
                  🔁 {t('subReceipt')} · {t('subNext')} {result.order.nextDeliveryAt ? new Date(result.order.nextDeliveryAt).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { dateStyle: 'medium' }) : ''}
                </p>
              )}
            </div>

            <div className="clay-green mt-4 rounded-2xl p-3.5">
              <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-[var(--al-ink)]">
                <Zap className="h-4 w-4" /> {t('payoutProof')}
              </p>
              <p className="mt-0.5 text-[10px] font-semibold text-[var(--al-olive)]">{t('utrNote')}</p>
              <div className="mt-2.5 space-y-1.5">
                {result.payouts.map((p) => (
                  <div key={p.payoutRef} className="flex items-center gap-2.5 rounded-xl bg-[var(--al-glass)] p-2.5">
                    <span className="text-xl">{p.farmerAvatar}</span>
                    <div className="min-w-0 flex-1 leading-tight">
                      <p className="truncate text-[12px] font-extrabold text-[var(--al-ink)]">
                        {p.farmerName} → <span className="text-[var(--al-green)]">{rs(p.amountRs)}</span>
                      </p>
                      <p className="truncate font-mono text-[9px] text-[var(--al-olive-2)]">{p.upiId} · {p.payoutRef}</p>
                    </div>
                    <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--al-green)]" />
                  </div>
                ))}
              </div>
            </div>

            <div className="clay mt-3 rounded-2xl p-3 text-xs font-semibold">
              <div className="flex justify-between text-foreground/70">
                <span>{t('toPay')}</span>
                <span>{rs(result.order.totalRs)}</span>
              </div>
              {result.discountRs > 0 && (
                <div className="mt-1 flex justify-between font-black text-[var(--al-green)]">
                  <span>{result.order.promoCode} 🎉</span>
                  <span>−{rs(result.discountRs)}</span>
                </div>
              )}
              {result.subDiscountRs > 0 && (
                <div className="mt-1 flex justify-between font-black text-[var(--al-green)]">
                  <span>🔁 {t('subLine')} 🎉</span>
                  <span>−{rs(result.subDiscountRs)}</span>
                </div>
              )}
              {(result.order.tipRs ?? 0) > 0 && (
                <div className="mt-1 flex justify-between text-foreground/70">
                  <span>{t('tipLine')}</span>
                  <span>{rs(result.order.tipRs)}</span>
                </div>
              )}
              {(result.order.walletUsedRs ?? 0) > 0 && (
                <div className="mt-1 flex justify-between font-black text-[var(--al-green)]">
                  <span>👛 {t('walletLine').replace('{n}', String(result.order.walletUsedRs))}</span>
                  <span>−{rs(result.order.walletUsedRs)}</span>
                </div>
              )}
              <div className="mt-1 flex justify-between font-black text-[var(--al-green)]">
                <span>{t('farmerGets')}</span>
                <span>{rs(result.order.farmerPayoutRs)}</span>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="neu h-10 rounded-2xl border-0 text-xs font-extrabold"
                onClick={shareReceipt}
              >
                <Share2 className="h-4 w-4" /> {t('shareReceipt')}
              </Button>
              <Button
                variant="outline"
                className="neu h-10 rounded-2xl border-0 text-xs font-extrabold"
                onClick={saveReceiptImage}
              >
                <Download className="h-4 w-4" /> {t('saveImage')}
              </Button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="neu h-11 rounded-2xl border-0 text-xs font-extrabold"
                onClick={() => {
                  close(true)
                  setCartOpen(false)
                  setStep('cart')
                  setResult(null)
                  setView('orders')
                }}
              >
                {t('trackOrder')}
              </Button>
              <Button
                className="al-add h-11 rounded-2xl text-xs font-black"
                onClick={() => {
                  setStep('cart')
                  setResult(null)
                  setCartOpen(false)
                }}
              >
                {t('continueShopping')}
              </Button>
            </div>

            <p className="mt-3 flex items-center justify-center gap-1 text-center text-[10px] font-bold text-muted-foreground">
              <Sparkles className="h-3 w-3 text-[var(--al-amber)]" /> Powered by mock Razorpay X — sub-2-min payouts in production
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
