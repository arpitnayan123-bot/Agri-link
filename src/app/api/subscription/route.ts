import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, ok, fail } from '@/lib/api-helpers'

// Subscription management (closes the round-15 known limit — the weekly basket
// is no longer a one-way toggle):
//   GET  /api/subscription?phone=...  → active subscription state (latest order)
//   POST /api/subscription { phone, action: 'SKIP' | 'CANCEL' | 'RESUME' }
//     SKIP   → next delivery pushed by one week (weekly basket keeps running)
//     CANCEL → subscription stopped (nextDeliveryAt cleared)
//     RESUME → re-arm the weekly basket (nextDeliveryAt = +7 days)

const WEEK_MS = 7 * 24 * 3600_000

export async function GET(req: NextRequest) {
  return guard(async () => {
    const phone = req.nextUrl.searchParams.get('phone')
    if (!phone || phone.trim().length < 6) return fail('phone is required')
    const latest = await db.order.findFirst({
      where: { buyerPhone: phone.trim() },
      orderBy: { createdAt: 'desc' },
    })
    if (!latest) return ok({ subscription: null, nextDeliveryAt: null, orderId: null })
    return ok({
      subscription: latest.subscription,
      nextDeliveryAt: latest.nextDeliveryAt,
      orderId: latest.id,
      code: latest.code,
    })
  })
}

export async function POST(req: NextRequest) {
  return guard(async () => {
    const body = (await req.json().catch(() => ({}))) as { phone?: string; action?: string }
    if (!body.phone || body.phone.trim().length < 6) return fail('phone is required')
    const phone = body.phone.trim()
    const action = (body.action ?? '').toUpperCase()
    if (!['SKIP', 'CANCEL', 'RESUME'].includes(action)) return fail("action must be SKIP, CANCEL or RESUME")

    const latest = await db.order.findFirst({
      where: { buyerPhone: phone },
      orderBy: { createdAt: 'desc' },
    })
    if (!latest) return fail('No orders found for this phone', 404)

    if (action === 'RESUME') {
      const updated = await db.order.update({
        where: { id: latest.id },
        data: { subscription: 'WEEKLY', nextDeliveryAt: new Date(Date.now() + WEEK_MS) },
      })
      await db.notification.create({
        data: {
          phone,
          kind: 'ORDER',
          icon: '🔁',
          title: 'Weekly basket resumed',
          body: `Your weekly 5%-off basket is back on. The next harvest-and-delivery window opens soon.`,
        },
      })
      return ok({ subscription: updated.subscription, nextDeliveryAt: updated.nextDeliveryAt, code: updated.code, action })
    }

    if (!latest.subscription) return fail('No active weekly basket on the latest order', 409)
    if (!latest.nextDeliveryAt) return fail('This subscription has no scheduled delivery', 409)

    if (action === 'SKIP') {
      const updated = await db.order.update({
        where: { id: latest.id },
        data: { nextDeliveryAt: new Date(latest.nextDeliveryAt.getTime() + WEEK_MS) },
      })
      await db.notification.create({
        data: {
          phone,
          kind: 'ORDER',
          icon: '⏭️',
          title: 'Next basket skipped',
          body: `Your weekly basket will now arrive from ${updated.nextDeliveryAt?.toLocaleDateString('en-IN', { dateStyle: 'medium' })}. Skip again any time.`,
        },
      })
      return ok({ subscription: updated.subscription, nextDeliveryAt: updated.nextDeliveryAt, code: updated.code, action })
    }

    // CANCEL
    const updated = await db.order.update({
      where: { id: latest.id },
      data: { subscription: null, nextDeliveryAt: null },
    })
    await db.notification.create({
      data: {
        phone,
        kind: 'ORDER',
        icon: '🔁',
        title: 'Weekly basket cancelled',
        body: `No more weekly baskets scheduled for now. You can re-arm it any time from My Orders — the 5% saving will be waiting.`,
      },
    })
    return ok({ subscription: updated.subscription, nextDeliveryAt: updated.nextDeliveryAt, code: updated.code, action })
  })
}
