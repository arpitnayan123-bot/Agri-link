import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { guard, ok, fail } from '@/lib/api-helpers'
import { billFor, PROMOS, SUBSCRIPTIONS } from '@/lib/agrilink-client'

// Demo clock: every stage takes ~2.5 min so the lifecycle feels alive.
const STAGE_MS = 150_000
const LIFECYCLE = ['PAID', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED'] as const

// Slot-aware lifecycle gating (closes the round-14 known limit): a scheduled
// order's lifecycle clock starts when its delivery WINDOW OPENS, not at
// payment — production-shaped logic, compressed offsets for the demo so a
// session can still watch the full journey. EXPRESS starts immediately.
const SLOT_DEMO_OPEN_MIN: Record<string, number> = {
  EXPRESS: 0,
  TODAY_EVE: 4,
  TODAY_NIGHT: 8,
  TMR_MORN: 12,
  TMR_EVE: 16,
}

function windowOpensAt(o: Pick<OrderWithItems, 'createdAt' | 'slotKey'>): number {
  const openMin = SLOT_DEMO_OPEN_MIN[o.slotKey ?? 'EXPRESS'] ?? 0
  return o.createdAt.getTime() + openMin * 60_000
}

const ORDER_INCLUDE = { items: { include: { farmer: { select: { name: true, avatar: true, village: true } } } } } satisfies Prisma.OrderInclude

type OrderWithItems = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>

function shapeOrder(o: OrderWithItems) {
  return {
    ...o,
    items: o.items.map((it) => ({
      id: it.id,
      productId: it.productId,
      name: it.name,
      emoji: it.emoji,
      unitLabel: it.unitLabel,
      qty: it.qty,
      unitPriceRs: it.unitPriceRs,
      farmerPayoutRs: it.farmerPayoutRs,
      payoutRef: it.payoutRef,
      farmerName: it.farmer.name,
      farmerAvatar: it.farmer.avatar,
      farmerVillage: it.farmer.village,
    })),
  }
}

// Auto-advance: PAID → PACKED → OUT_FOR_DELIVERY → DELIVERED on the demo clock,
// gated by the delivery window (scheduled orders don't move until the window
// opens). Returns minutes until the next hop so the UI can show a countdown.
async function autoAdvance(orders: OrderWithItems[]): Promise<OrderWithItems[]> {
  const now = Date.now()
  const changed: { id: string; status: string }[] = []
  for (const o of orders) {
    if (o.status === 'DELIVERED' || o.status === 'CANCELLED') continue // terminal states never move
    const opensAt = windowOpensAt(o)
    if (now < opensAt) continue // window not open yet — order waits, farmer not scheduled
    const idx = LIFECYCLE.indexOf(o.status as (typeof LIFECYCLE)[number])
    if (idx < 0) continue // unknown status — never auto-mutate it
    const target = Math.min(LIFECYCLE.length - 1, Math.floor((now - opensAt) / STAGE_MS))
    if (target > idx) {
      o.status = LIFECYCLE[target]
      changed.push({ id: o.id, status: LIFECYCLE[target] })
    }
  }
  await Promise.all(changed.map((c) => db.order.update({ where: { id: c.id }, data: { status: c.status } })))
  return orders
}

function withCountdown(o: OrderWithItems) {
  const now = Date.now()
  if (o.status === 'CANCELLED' || o.status === 'DELIVERED') return { ...shapeOrder(o), nextStageInMin: 0, awaitingWindow: false }
  const opensAt = windowOpensAt(o)
  const awaitingWindow = now < opensAt
  const idx = LIFECYCLE.indexOf(o.status as (typeof LIFECYCLE)[number])
  const nextIn = awaitingWindow
    ? Math.max(1, Math.ceil((opensAt - now) / 60_000))
    : Math.max(0, Math.ceil((opensAt + (idx + 1) * STAGE_MS - now) / 60_000))
  return { ...shapeOrder(o), nextStageInMin: nextIn, awaitingWindow }
}

// GET /api/orders?phone=+91... — order book for a buyer (auto-advances lifecycle)
export async function GET(req: NextRequest) {
  return guard(async () => {
    const phone = req.nextUrl.searchParams.get('phone')
    const orders = await db.order.findMany({
      where: phone ? { buyerPhone: phone } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: ORDER_INCLUDE,
    })
    await autoAdvance(orders)
    return ok(orders.map(withCountdown))
  })
}

type PayIn = {
  buyerName: string
  buyerPhone: string
  buyerCity: string
  address: string
  promoCode?: string
  slotKey?: string
  subscription?: string
  tipRs?: number
  useWallet?: boolean
  items: { productId: string; qty: number }[]
}

// Delivery slots — server-side whitelist; the client renders localized labels.
const SLOT_KEYS = ['EXPRESS', 'TODAY_EVE', 'TODAY_NIGHT', 'TMR_MORN', 'TMR_EVE']

// Delivery-partner tip whitelist — 100% passes through to the rider.
const TIP_WHITELIST = [0, 10, 20, 30, 50]

// POST /api/orders — the zero-middleman moment:
// 1. Validate stock. 2. One UPI payment (mock). 3. INSTANT Razorpay-X-mock
// payout per farmer. 4. Decrement stock. Farmer's price is never touched.
export async function POST(req: NextRequest) {
  return guard(async () => {
    const body = (await req.json()) as PayIn
    if (!body?.buyerName || !body?.buyerPhone || !body?.address || !Array.isArray(body.items) || body.items.length === 0) {
      return fail('buyerName, buyerPhone, address and items[] are required')
    }

    const lines = body.items.filter((i) => i.qty > 0 && i.productId)
    if (!lines.length) return fail('At least one item with qty > 0')

    const products = await db.product.findMany({
      where: { id: { in: lines.map((l) => l.productId) } },
      include: { farmer: true },
    })
    if (products.length !== lines.length) return fail('Some products no longer exist')

    // Stock check
    for (const l of lines) {
      const p = products.find((x) => x.id === l.productId)!
      if (p.stockKg < l.qty) return fail(`Only ${p.stockKg} ${p.unitLabel} of ${p.name} left`)
    }

    const itemsTotal = lines.reduce((s, l) => {
      const p = products.find((x) => x.id === l.productId)!
      return s + p.priceRs * l.qty
    }, 0)

    // Promo (platform-subsidized, shared coupon book with the UI)
    const promoKey = (body.promoCode ?? '').trim().toUpperCase()
    const promo = promoKey ? PROMOS[promoKey] : undefined
    if (promoKey && !promo) return fail(`Promo "${promoKey}" is not valid — try FRESH10`)
    if (promo && itemsTotal < promo.min) {
      return fail(`Coupon ${promoKey} needs a minimum order of ₹${promo.min}`)
    }
    const discountRs = promo ? Math.min(Math.round(promo.pct != null ? itemsTotal * promo.pct : promo.flat ?? 0), promo.cap) : 0

    // Subscription (whitelisted) — 5% weekly, platform-funded, stacks with promos.
    const subKey = (body.subscription ?? '').trim().toUpperCase()
    const sub = subKey ? SUBSCRIPTIONS[subKey] : undefined
    if (subKey && !sub) return fail(`Subscription "${subKey}" is not valid — try WEEKLY`)
    const subDiscountRs = sub ? Math.min(Math.round(itemsTotal * sub.pct), sub.cap) : 0
    const nextDeliveryAt = sub ? new Date(Date.now() + sub.days * 24 * 3600_000) : null

    // Delivery slot (Express default) — whitelisted, never trusted raw.
    const slotKey = SLOT_KEYS.includes(body.slotKey ?? '') ? (body.slotKey as string) : 'EXPRESS'
    // Scheduled windows are harvested-to-door within the chosen slot: the
    // demo clock still runs, but the promise shown to the buyer is the slot.
    const etaMin = slotKey === 'EXPRESS' ? 90 + Math.floor(Math.random() * 60) : 240

    // Delivery-partner tip — whitelisted, 100% pass-through.
    const tipRs = TIP_WHITELIST.includes(Math.round(Number(body.tipRs ?? 0))) ? Math.round(Number(body.tipRs ?? 0)) : 0

    const base = billFor(itemsTotal, tipRs)
    const preWallet = base.totalRs - discountRs - subDiscountRs

    // AgriLink wallet — optional spend at checkout, capped at the bill amount.
    let walletUsedRs = 0
    if (body.useWallet) {
      const agg = await db.walletTx.aggregate({ where: { phone: body.buyerPhone.trim() }, _sum: { amountRs: true } })
      const balance = agg._sum.amountRs ?? 0
      walletUsedRs = Math.max(0, Math.min(Math.floor(balance), preWallet))
    }
    const bill = { ...base, totalRs: preWallet - walletUsedRs }

    // Mock consumer UPI collect
    const upiRef = `UPI${Date.now().toString(36).toUpperCase()}`

    const nextCode = `AL-${10001 + (await db.order.count())}`

    const order = await db.order.create({
      data: {
        code: nextCode,
        buyerName: body.buyerName,
        buyerPhone: body.buyerPhone,
        buyerCity: body.buyerCity || 'Pune',
        address: body.address,
        itemsTotalRs: bill.itemsTotal,
        discountRs: discountRs + subDiscountRs,
        promoCode: discountRs > 0 ? promoKey : null,
        deliveryFeeRs: bill.deliveryFeeRs,
        platformFeeRs: bill.platformFeeRs,
        tipRs,
        walletUsedRs,
        totalRs: bill.totalRs,
        farmerPayoutRs: bill.itemsTotal,
        upiRef,
        status: 'PAID',
        slotKey,
        etaMin,
        subscription: sub ? subKey : null,
        nextDeliveryAt,
      },
    })

    // Wallet spend recorded as a negative ledger entry (only if actually used).
    if (walletUsedRs > 0) {
      await db.walletTx.create({
        data: { phone: body.buyerPhone.trim(), type: 'SPEND', amountRs: -walletUsedRs, note: `Paid via wallet · ${nextCode}`, ref: upiRef },
      })
    }

    // In-app receipt: the notification center mirrors the WhatsApp updates.
    await db.notification.create({
      data: {
        phone: body.buyerPhone.trim(),
        kind: 'ORDER',
        icon: '✅',
        title: `Order ${nextCode} confirmed`,
        body: `${body.buyerName.split(' ')[0]}, your farmers were paid ₹${Math.round(itemsTotal)} instantly over UPI. Harvest starts now — track it live in My Orders.`,
      },
    })

    // Instant payouts — group items by farmer, one payout per farmer.
    const byFarmer = new Map<string, typeof lines>()
    for (const l of lines) {
      const p = products.find((x) => x.id === l.productId)!
      const arr = byFarmer.get(p.farmerId) ?? []
      arr.push(l)
      byFarmer.set(p.farmerId, arr)
    }

    const payoutProofs: { farmerName: string; farmerAvatar: string; amountRs: number; payoutRef: string; upiId: string }[] = []

    for (const [farmerId, fLines] of byFarmer) {
      const amount = fLines.reduce((s, l) => {
        const p = products.find((x) => x.id === l.productId)!
        return s + p.priceRs * l.qty
      }, 0)
      // Mock Razorpay X instant payout — <2 min in production.
      const payoutRef = `payout_${Math.random().toString(36).slice(2, 16)}`
      const farmer = products.find((x) => x.id === fLines[0].productId)!.farmer
      payoutProofs.push({ farmerName: farmer.name, farmerAvatar: farmer.avatar, amountRs: Math.round(amount), payoutRef, upiId: farmer.upiId })

      await db.farmer.update({ where: { id: farmerId }, data: { totalEarnedRs: { increment: amount } } })

      for (const l of fLines) {
        const p = products.find((x) => x.id === l.productId)!
        await db.orderItem.create({
          data: {
            orderId: order.id,
            productId: p.id,
            farmerId: p.farmerId,
            name: p.name,
            emoji: p.emoji,
            unitLabel: p.unitLabel,
            qty: l.qty,
            unitPriceRs: p.priceRs,
            farmerPayoutRs: p.priceRs * l.qty,
            payoutRef,
          },
        })
        await db.product.update({ where: { id: p.id }, data: { stockKg: { decrement: l.qty } } })
      }
    }

    const full = await db.order.findUnique({
      where: { id: order.id },
      include: ORDER_INCLUDE,
    })

    return ok({
      order: full ? withCountdown(full) : null,
      payouts: payoutProofs,
      discountRs,
      subDiscountRs,
      walletUsedRs,
      tipRs,
    })
  })
}
