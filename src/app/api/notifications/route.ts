import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, ok, fail } from '@/lib/api-helpers'

// Notification center (bell):
//   GET  /api/notifications?phone=...      → latest 20 + unread count
//   POST /api/notifications { phone, ids } → mark read (ids[] or ALL unread)

export async function GET(req: NextRequest) {
  return guard(async () => {
    const phone = req.nextUrl.searchParams.get('phone')
    if (!phone || phone.trim().length < 6) return fail('phone is required')
    const phoneClean = phone.trim()
    const [notifications, unreadAgg] = await Promise.all([
      db.notification.findMany({ where: { phone: phoneClean }, orderBy: { createdAt: 'desc' }, take: 20 }),
      db.notification.count({ where: { phone: phoneClean, readAt: null } }),
    ])
    return ok({ notifications, unread: unreadAgg })
  })
}

export async function POST(req: NextRequest) {
  return guard(async () => {
    const body = (await req.json().catch(() => ({}))) as { phone?: string; ids?: string[] }
    if (!body.phone || body.phone.trim().length < 6) return fail('phone is required')
    const where = body.ids?.length
      ? { phone: body.phone.trim(), id: { in: body.ids }, readAt: null }
      : { phone: body.phone.trim(), readAt: null }
    const res = await db.notification.updateMany({ where, data: { readAt: new Date() } })
    return ok({ markedRead: res.count })
  })
}
