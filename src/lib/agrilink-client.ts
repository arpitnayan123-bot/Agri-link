// AgriLink client-safe helpers: types, API fetch, freshness math, formatting.
// Used by both the page components and (pure parts only) anywhere else.

export type Farmer = {
  id: string
  name: string
  village: string
  district: string
  state: string
  avatar: string
  story: string
  storyHi: string
  rating: number
  kycVerified: boolean
  totalEarnedRs: number
  followers: number
  upiId: string
}

export type Product = {
  id: string
  name: string
  nameHi: string
  category: string
  emoji: string
  description: string
  descriptionHi: string
  unitLabel: string
  priceRs: number
  mrpRs: number
  mandiPriceRs: number
  chemicalFree: boolean
  harvestedAt: string
  stockKg: number
  tags: string // JSON array string
  isBestseller: boolean
  rating: number
  accent: string
  farmerId: string
  farmer: Farmer
  reviewCount: number
}

export type ReviewT = {
  id: string
  productId: string
  name: string
  rating: number
  comment: string
  lang: string
  source: string // BUYER | SEED
  orderCode: string | null
  createdAt: string
}

export type ReviewsResponse = {
  reviews: ReviewT[]
  count: number
  buyerCount: number
  avg: number
}

export type OrderItemT = {
  id: string
  productId: string
  name: string
  emoji: string
  unitLabel: string
  qty: number
  unitPriceRs: number
  farmerPayoutRs: number
  payoutRef?: string | null
  farmerName: string
  farmerAvatar: string
}

export type Order = {
  id: string
  code: string
  buyerName: string
  buyerPhone: string
  buyerCity: string
  address: string
  itemsTotalRs: number
  discountRs: number
  promoCode?: string | null
  deliveryFeeRs: number
  platformFeeRs: number
  tipRs: number
  walletUsedRs: number
  totalRs: number
  farmerPayoutRs: number
  upiRef?: string | null
  status: string // PAID | PACKED | OUT_FOR_DELIVERY | DELIVERED | CANCELLED
  slotKey?: string
  etaMin: number
  subscription?: string | null
  nextDeliveryAt?: string | null
  cancelReason?: string | null
  cancelledAt?: string | null
  refundRs?: number
  refundRef?: string | null
  issueReason?: string | null
  issueStatus?: string | null
  createdAt: string
  nextStageInMin?: number
  awaitingWindow?: boolean
  items: OrderItemT[]
}

export type AddressT = {
  id: string
  phone: string
  label: string
  receiver: string
  line: string
  city: string
  isDefault: boolean
}

export type WalletTxT = {
  id: string
  type: 'WELCOME' | 'REFERRAL' | 'REFUND' | 'SPEND'
  amountRs: number
  note: string
  ref?: string | null
  createdAt: string
}

export type WalletResponse = { balanceRs: number; txs: WalletTxT[] }

export type NotificationT = {
  id: string
  kind: 'ORDER' | 'WALLET' | 'SOCIAL' | 'SYSTEM'
  icon: string
  title: string
  body: string
  readAt: string | null
  createdAt: string
}

export type NotificationsResponse = { notifications: NotificationT[]; unread: number }

export type CouponT = {
  code: string
  en: string
  hi: string
  min: number
  cap: number
}

export type ReferralResponse = { code: string; invites: number; earnedRs: number }

export type Stats = {
  farmers: number
  products: number
  orders: number
  paidToFarmersRs: number
  avgFarmerSharePct: number
  kgDelivered: number
}

export const CATEGORIES = [
  { key: 'ALL', emoji: '🧺', en: 'All', hi: 'सब' },
  { key: 'BESTSELLERS', emoji: '🔥', en: 'Bestsellers', hi: 'बेस्टसेलर' },
  { key: 'VEGETABLES', emoji: '🥕', en: 'Veggies', hi: 'सब्ज़ियाँ' },
  { key: 'LEAFY', emoji: '🥬', en: 'Leafy', hi: 'पत्तेदार' },
  { key: 'HERBS', emoji: '🌿', en: 'Herbs', hi: 'हर्ब्स' },
  { key: 'FRUITS', emoji: '🥭', en: 'Fruits', hi: 'फल' },
] as const

// Each accent ships literal light + dark classes (Tailwind JIT picks both up
// from this file) so product-card heroes stay premium in either theme.
export const ACCENTS: Record<string, { bg: string; ring: string; text: string }> = {
  tomato: { bg: 'bg-[#FFE9E0] dark:bg-[#3a231d]', ring: 'ring-[#FFD4C2]', text: 'text-[#C2410C] dark:text-[#fda883]' },
  amber: { bg: 'bg-[#FFEEDB] dark:bg-[#37281a]', ring: 'ring-[#FFDDB5]', text: 'text-[#9A3412] dark:text-[#fdba74]' },
  tan: { bg: 'bg-[#F5E9D7] dark:bg-[#322a1f]', ring: 'ring-[#EAD9BC]', text: 'text-[#7C5A34] dark:text-[#d9bd93]' },
  lime: { bg: 'bg-[#EAF6DE] dark:bg-[#24301c]', ring: 'ring-[#D5EBBD]', text: 'text-[#3F6212] dark:text-[#c3e582]' },
  plum: { bg: 'bg-[#F1E5F5] dark:bg-[#2d2436]', ring: 'ring-[#E0CBEA]', text: 'text-[#6B21A8] dark:text-[#d5a8f2]' },
  emerald: { bg: 'bg-[#DFF3E9] dark:bg-[#1d3228]', ring: 'ring-[#BFE6D3]', text: 'text-[#065F46] dark:text-[#7ee0b8]' },
  teal: { bg: 'bg-[#DFF2F2] dark:bg-[#1c3232]', ring: 'ring-[#BCE4E4]', text: 'text-[#155E63] dark:text-[#83d6d8]' },
  sky: { bg: 'bg-[#E3EEFB] dark:bg-[#1f2a3d]', ring: 'ring-[#C6DCF7]', text: 'text-[#1E40AF] dark:text-[#a4c3f9]' },
  orange: { bg: 'bg-[#FFEAD8] dark:bg-[#3a2818]', ring: 'ring-[#FFD3AE]', text: 'text-[#C2410C] dark:text-[#fda883]' },
  chilli: { bg: 'bg-[#FFE5E5] dark:bg-[#3a2020]', ring: 'ring-[#FFC7C7]', text: 'text-[#B91C1C] dark:text-[#fda4a4]' },
  stone: { bg: 'bg-[#EEECE7] dark:bg-[#2c2b28]', ring: 'ring-[#DEDAD1]', text: 'text-[#57534E] dark:text-[#d6d1c8]' },
  mango: { bg: 'bg-[#FFF3CE] dark:bg-[#373015]', ring: 'ring-[#FFE59E]', text: 'text-[#A16207] dark:text-[#fcd34d]' },
  leafy: { bg: 'bg-[#E4F3DC] dark:bg-[#223320]', ring: 'ring-[#CBE7BB]', text: 'text-[#166534] dark:text-[#93dcab]' },
  mint: { bg: 'bg-[#DFF7EC] dark:bg-[#1c332a]', ring: 'ring-[#BEEFDC]', text: 'text-[#047857] dark:text-[#6ee7c0]' },
  berry: { bg: 'bg-[#FBE1EE] dark:bg-[#362230]', ring: 'ring-[#F6C6DE]', text: 'text-[#9D174D] dark:text-[#f6a8cd]' },
}

export function accentOf(key: string) {
  return ACCENTS[key] ?? ACCENTS.leafy
}

/* ─── AI Freshness (client-safe pure math) ─────────────────────────────────── */

// Score decays with hours since harvest; bucketed to 1h steps.
// Fresh-picked ≈ 97-99, yesterday ≈ 80s, two days ≈ 70s, floor 52.
export function freshnessScore(harvestedAt: string | Date, now: number = Date.now()): number {
  const h = (new Date(harvestedAt).getTime() - now) / 3600_000
  const hours = Math.max(0, -h)
  return Math.max(52, Math.min(99, Math.round(99 - hours * 0.75)))
}

export function freshnessLabel(score: number, lang: 'en' | 'hi'): string {
  if (score >= 90) return lang === 'hi' ? 'आज तुड़ा' : 'Picked today'
  if (score >= 75) return lang === 'hi' ? 'बहुत ताज़ा' : 'Very fresh'
  if (score >= 60) return lang === 'hi' ? 'अच्छा' : 'Good'
  return lang === 'hi' ? 'ठीक-ठाक' : 'Fair'
}

export function freshnessColor(score: number): string {
  if (score >= 90) return '#16a34a'
  if (score >= 75) return '#65a30d'
  if (score >= 60) return '#d97706'
  return '#dc2626'
}

export function harvestedLabel(harvestedAt: string | Date, lang: 'en' | 'hi'): string {
  const hours = Math.max(0, (Date.now() - new Date(harvestedAt).getTime()) / 3600_000)
  if (hours < 1) return lang === 'hi' ? 'अभी-अभी तुड़ा' : 'Just picked'
  if (hours < 24) return lang === 'hi' ? `${Math.round(hours)} घंटे पहले तुड़ा` : `Picked ${Math.round(hours)}h ago`
  const days = Math.floor(hours / 24)
  return lang === 'hi' ? `${days} दिन पहले तुड़ा` : `Picked ${days}d ago`
}

/* ─── Demo reviews (deterministic per product, labeled in UI) ──────────────── */

const REVIEW_NAMES = [
  'Priya M.', 'Arjun K.', 'Kavita S.', 'Rohit P.', 'Ananya D.', 'Vikram J.',
  'Neha V.', 'Sandeep R.', 'Meera T.', 'Aditya G.', 'Divya N.', 'Karan B.',
]
const REVIEW_COMMENTS: [string, string][] = [
  ['Tastes like the tomatoes from my grandmother\'s garden — zero comparison with supermarket.', 'सुपरमार्केट वाले टमाटर से बिल्कुल अलग — दादी के बगीचे जैसा स्वाद।'],
  ['Arrived within 2 hours, still cool from the morning harvest. Packing was neat.', '2 घंटे में पहुँच गया, सुबह की तुड़ाई जैसा ताज़ा। पैकिंग बढ़िया।'],
  ['You can literally smell the freshness. The farmer note in the box was a sweet touch.', 'ताज़गी की खुशबू साफ़ महसूस होती है। डिब्बे में किसान की चिट्ठी अच्छी लगी।'],
  ['Bought for the zero-chemical promise, staying for the taste. Kids loved it.', 'केमिकल-फ़्री होने के लिए खरीदा, स्वाद के लिए रुक गया। बच्चों को पसंद आया।'],
  ['Fair price and the receipt showing exactly what the farmer got — brilliant transparency.', 'सही दाम और रसीद में किसान का हिस्सा साफ़ — शानदार पारदर्शिता।'],
  ['Curry leaves were so fragrant, the whole kitchen smelled like a Kerala morning.', 'करी पत्ते इतने खुशबूदार कि पूरा किचन केरल की सुबह जैसा लगा।'],
  ['Delivery was quick but the leafy greens wilted slightly by evening. Still fresher than mandi.', 'डिलीवरी तेज़ थी, शाम तक पत्ते थोड़े मुरझाए — फिर भी मंडी से ताज़ा।'],
  ['Third order this month. Quality has been consistent every single time.', 'इस महीने तीसरा ऑर्डर। हर बार क्वालिटी एक जैसी रही।'],
]

export type DemoReview = { name: string; rating: number; comment: string; daysAgo: number }

export function demoReviewsFor(productId: string, baseRating: number): DemoReview[] {
  let hash = 0
  for (let i = 0; i < productId.length; i++) hash = (hash * 31 + productId.charCodeAt(i)) >>> 0
  const count = 2 + (hash % 2) // 2-3 reviews
  const used = new Set<number>()
  const reviews: DemoReview[] = []
  for (let i = 0; i < count; i++) {
    let idx = (hash + i * 7) % REVIEW_COMMENTS.length
    while (used.has(idx)) idx = (idx + 1) % REVIEW_COMMENTS.length
    used.add(idx)
    const jitter = ((hash >>> i) % 5) - 2 // ±0.2 around product rating
    reviews.push({
      name: REVIEW_NAMES[(hash + i * 11) % REVIEW_NAMES.length],
      rating: Math.min(5, Math.max(3.5, Math.round((baseRating + jitter * 0.1) * 10) / 10)),
      comment: REVIEW_COMMENTS[idx][i % 2 ? 1 : 0], // mix EN/HI like real India
      daysAgo: 1 + ((hash >>> (i * 2)) % 9),
    })
  }
  return reviews
}

/* ─── Money & API ──────────────────────────────────────────────────────────── */

export const rs = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

// 1284 → "1.2k", 497 → "497" — Instagram-style compact social proof.
export function fmtFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return `${n}`
}

export const DELIVERY_FEE = 29
export const FREE_ABOVE = 249
export const PLATFORM_FEE_PCT = 0.08

/* ─── Delivery slots (Blinkit-parity scheduling) ─────────────────────────── */

export type SlotKey = 'EXPRESS' | 'TODAY_EVE' | 'TODAY_NIGHT' | 'TMR_MORN' | 'TMR_EVE'

export const DELIVERY_SLOTS: { key: SlotKey; emoji: string; en: string; hi: string }[] = [
  { key: 'EXPRESS', emoji: '⚡', en: 'Express · in ~2 hrs', hi: 'एक्सप्रेस · ~2 घंटे' },
  { key: 'TODAY_EVE', emoji: '🌆', en: 'Today · 5–8 PM', hi: 'आज · शाम 5–8' },
  { key: 'TODAY_NIGHT', emoji: '🌙', en: 'Today · 8–10 PM', hi: 'आज · रात 8–10' },
  { key: 'TMR_MORN', emoji: '🌅', en: 'Tomorrow · 7–10 AM', hi: 'कल · सुबह 7–10' },
  { key: 'TMR_EVE', emoji: '🌇', en: 'Tomorrow · 5–8 PM', hi: 'कल · शाम 5–8' },
]

export function slotLabel(key: string | null | undefined, lang: 'en' | 'hi'): string {
  const s = DELIVERY_SLOTS.find((x) => x.key === key)
  if (!s) return lang === 'hi' ? 'एक्सप्रेस · ~2 घंटे' : 'Express · in ~2 hrs'
  return lang === 'hi' ? s.hi : s.en
}

/* ─── Promos (shared by cart sheet + cart bar so the bar never lies) ─────── */

// The coupon book: pct OR flat discount, platform-subsidized — the farmer's
// payout is NEVER reduced. Server validates against the same table at pay time.
export const PROMOS: Record<string, { pct?: number; flat?: number; cap: number; min: number; en: string; hi: string }> = {
  FRESH10: { pct: 0.1, cap: 100, min: 0, en: '10% off (up to ₹100)', hi: '10% छूट (₹100 तक)' },
  SABZI50: { flat: 50, cap: 50, min: 299, en: '₹50 off on ₹299+', hi: '₹299+ पर ₹50 छूट' },
  MANGO20: { pct: 0.2, cap: 80, min: 199, en: '20% off on ₹199+ (up to ₹80)', hi: '₹199+ पर 20% छूट (₹80 तक)' },
}

export function couponList(): CouponT[] {
  return Object.entries(PROMOS).map(([code, c]) => ({ code, en: c.en, hi: c.hi, min: c.min, cap: c.cap }))
}

export function couponErrorFor(code: string | null | undefined, itemsTotal: number, lang: 'en' | 'hi'): string | null {
  if (!code) return null
  const p = PROMOS[code]
  if (!p) return lang === 'hi' ? `"${code}" मान्य नहीं — FRESH10 आज़माएँ` : `"${code}" is not valid — try FRESH10`
  if (itemsTotal < p.min) {
    const need = Math.ceil(p.min - itemsTotal)
    return lang === 'hi' ? `${rs(p.min)} के ऑर्डर पर लागू — ${rs(need)} और जोड़ें` : `Valid on orders above ${rs(p.min)} — add ${rs(need)} more`
  }
  return null
}

export function promoDiscountFor(promoCode: string | null | undefined, itemsTotal: number): number {
  if (!promoCode) return 0
  const p = PROMOS[promoCode]
  if (!p || itemsTotal <= 0 || itemsTotal < p.min) return 0
  const raw = p.pct != null ? itemsTotal * p.pct : (p.flat ?? 0)
  return Math.min(Math.round(raw), p.cap)
}

/* ─── Subscriptions (weekly basket) — platform-funded, farmer untouched ──── */

export const SUBSCRIPTIONS: Record<string, { pct: number; cap: number; days: number }> = {
  WEEKLY: { pct: 0.05, cap: 150, days: 7 },
}

export function subDiscountFor(subscription: string | null | undefined, itemsTotal: number): number {
  if (!subscription) return 0
  const s = SUBSCRIPTIONS[subscription]
  if (!s || itemsTotal <= 0) return 0
  return Math.min(Math.round(itemsTotal * s.pct), s.cap)
}

/* ─── Delivery partner tip — 100% passes through to the rider ────────────── */

export const TIP_OPTIONS = [10, 20, 30] as const

/* ─── Referral code — deterministic per phone, shareable ─────────────────── */

export function referralCodeFor(phone: string): string {
  let h = 0
  const digits = phone.replace(/\D/g, '') || 'AGRILINK'
  for (let i = 0; i < digits.length; i++) h = (h * 31 + digits.charCodeAt(i)) >>> 0
  return `AGR-${h.toString(36).toUpperCase().padStart(6, '0').slice(-6)}`
}

export const REFERRAL_CREDIT_RS = 50

export function billFor(itemsTotal: number, tipRs = 0) {
  const deliveryFeeRs = itemsTotal >= FREE_ABOVE ? 0 : DELIVERY_FEE
  const platformFeeRs = Math.round(itemsTotal * PLATFORM_FEE_PCT)
  return { itemsTotal, deliveryFeeRs, platformFeeRs, tipRs, totalRs: itemsTotal + deliveryFeeRs + platformFeeRs + tipRs }
}

// The final bill the consumer pays: fees + tip + platform-subsidized discounts
// (promo and/or weekly subscription). Discounts NEVER touch the farmer payout
// (itemsTotal flows 100% to farms). Wallet is applied on top at pay time.
export function finalBillFor(itemsTotal: number, promoCode: string | null | undefined, subscription?: string | null, tipRs = 0) {
  const base = billFor(itemsTotal, tipRs)
  const discountRs = promoDiscountFor(promoCode, itemsTotal)
  const subDiscountRs = subDiscountFor(subscription, itemsTotal)
  return { ...base, discountRs, subDiscountRs, totalRs: base.totalRs - discountRs - subDiscountRs }
}

export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json() as Promise<T>
}

export async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json() as Promise<T>
}

export async function apiDelete<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: 'DELETE' })
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json() as Promise<T>
}
