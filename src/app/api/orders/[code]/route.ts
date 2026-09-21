import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { guard, ok, fail } from '@/lib/api-helpers'

// POST /api/orders/[code] — post-payment order actions, whitelisted:
//   { action: 'CANCEL', reason } → payout reversals + instant wallet refund
//   { action: 'ISSUE', reason }  → report a problem on a delivered order
//
// Cancel semantics (honest money flow): the farmer was ALREADY paid instantly,
// so "cancelling" initiates a mock Razorpay-X payout REVERSAL per farmer
// (farmer earnings adjusted), restores stock, and refunds EVERYTHING the buyer
// paid into their AgriLink wallet — instantly, with a proof ref.

const CANCELLABLE = new Set(['PAID', 'PACKED'])
const CANCEL_REASONS = ['Changed my mind', 'Ordered by mistake', 'Found a better price', 'Delivery too slow'] as const

type Body = { action?: string; reason?: string }

const ORDER_WITH_ITEMS = { items: { include: { farmer: { select: { id: true, name: true, avatar: true } } } } } satisfies Prisma.OrderInclude

type OrderWithItems = Prisma.OrderGetPayload<{ include: typeof ORDER_WITH_ITEMS }>

export async function POST(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  return guard(async () => {
    const { code } = await ctx.params
    const body = (await req.json().catch(() => ({}))) as Body

    const order = (await db.order.findUnique({
      where: { code },
      include: ORDER_WITH_ITEMS,
    })) as OrderWithItems | null
    if (!order) return fail('Order not found', 404)

    if (body.action === 'CANCEL') return cancel(order, body.reason)
    if (body.action === 'ISSUE') return reportIssue(order, body.reason)
    return fail('action must be CANCEL or ISSUE')
  })
}

async function cancel(order: OrderWithItems, reason?: string) {
  if (!CANCELLABLE.has(order.status)) {
    return fail(order.status === 'CANCELLED' ? 'Order is already cancelled' : 'Order is already out for delivery — it cannot be cancelled', 409)
  }
  const cleanReason = CANCEL_REASONS.includes(reason as (typeof CANCEL_REASONS)[number]) ? reason : (reason?.trim() || 'Changed my mind')

  // 1. Reverse each farmer's payout (mock Razorpay X reversal) + restore stock.
  const byFarmer = new Map<string, { name: string; avatar: string; amount: number }>()
  for (const it of order.items) {
    const cur = byFarmer.get(it.farmerId)
    if (cur) cur.amount += it.farmerPayoutRs
    else byFarmer.set(it.farmerId, { name: it.farmer.name, avatar: it.farmer.avatar, amount: it.farmerPayoutRs })
  }
  const reversalRefs: { farmerName: string; amountRs: number; reversalRef: string }[] = []
  for (const [farmerId, f] of byFarmer) {
    const reversalRef = `rev_${Math.random().toString(36).slice(2, 16)}`
    reversalRefs.push({ farmerName: f.name, amountRs: Math.round(f.amount), reversalRef })
    await db.farmer.update({ where: { id: farmerId }, data: { totalEarnedRs: { decrement: f.amount } } })
  }
  for (const it of order.items) {
    await db.product.update({ where: { id: it.productId }, data: { stockKg: { increment: it.qty } } })
  }

  // 2. Instant refund → buyer's AgriLink wallet (the honest destination: UPI
  // "reverse collect" takes 3-5 days; the wallet is instant and spendable).
  const refundRs = order.totalRs
  const refundRef = `refnd_${Math.random().toString(36).slice(2, 16)}`

  const updated = await db.order.update({
    where: { id: order.id },
    data: {
      status: 'CANCELLED',
      cancelReason: cleanReason,
      cancelledAt: new Date(),
      refundRs,
      refundRef,
    },
  })
  await db.walletTx.create({
    data: { phone: order.buyerPhone, type: 'REFUND', amountRs: refundRs, note: `Refund · ${order.code} cancelled`, ref: refundRef },
  })
  await db.notification.create({
    data: {
      phone: order.buyerPhone,
      kind: 'WALLET',
      icon: '↩️',
      title: `₹${Math.round(refundRs)} refunded to your wallet`,
      body: `Order ${order.code} was cancelled (${cleanReason}). Every farmer's payout was reversed and your refund landed in your AgriLink wallet instantly.`,
    },
  })

  return ok({ order: updated, reversalRefs, refundRs, refundRef, cancelReason: updated.cancelReason })
}

async function reportIssue(order: OrderWithItems, reason?: string) {
  if (order.status !== 'DELIVERED') return fail('Issues can be reported only after delivery', 409)
  const clean = reason?.trim()
  if (!clean) return fail('Tell us what went wrong (reason is required)')
  const updated = await db.order.update({
    where: { id: order.id },
    data: { issueReason: clean.slice(0, 300), issueStatus: 'OPEN' },
  })
  await db.notification.create({
    data: {
      phone: order.buyerPhone,
      kind: 'ORDER',
      icon: '🛟',
      title: 'We got your report',
      body: `Thanks for telling us about ${order.code}. Our farm-quality team will look into it and respond on WhatsApp within a few hours.`,
    },
  })
  return ok({ order: updated })
}

async function findOrder(code: string) {
  return db.order.findUnique({ where: { code } })
}
