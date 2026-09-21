import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, ok, fail } from '@/lib/api-helpers'

// Saved addresses — pick at checkout instead of retyping.
//   GET    /api/addresses?phone=...
//   POST   /api/addresses { phone, label, receiver, line, city, isDefault }
//   DELETE /api/addresses?id=...&phone=...

const LABELS = ['Home', 'Work', 'Other']

export async function GET(req: NextRequest) {
  return guard(async () => {
    const phone = req.nextUrl.searchParams.get('phone')
    if (!phone || phone.trim().length < 6) return fail('phone is required')
    const addresses = await db.address.findMany({
      where: { phone: phone.trim() },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })
    return ok(addresses)
  })
}

export async function POST(req: NextRequest) {
  return guard(async () => {
    const body = (await req.json().catch(() => ({}))) as {
      phone?: string
      label?: string
      receiver?: string
      line?: string
      city?: string
      isDefault?: boolean
    }
    if (!body.phone || body.phone.trim().length < 6) return fail('phone is required')
    if (!body.receiver?.trim() || !body.line?.trim()) return fail('receiver and line are required')

    const phone = body.phone.trim()
    const count = await db.address.count({ where: { phone } })
    const isDefault = body.isDefault === true || count === 0 // first saved address becomes default
    if (isDefault) {
      await db.address.updateMany({ where: { phone, isDefault: true }, data: { isDefault: false } })
    }
    const address = await db.address.create({
      data: {
        phone,
        label: LABELS.includes(body.label ?? '') ? (body.label as string) : 'Other',
        receiver: body.receiver.trim().slice(0, 80),
        line: body.line.trim().slice(0, 200),
        city: (body.city?.trim() || 'Pune').slice(0, 60),
        isDefault,
      },
    })
    return ok(address)
  })
}

export async function DELETE(req: NextRequest) {
  return guard(async () => {
    const id = req.nextUrl.searchParams.get('id')
    const phone = req.nextUrl.searchParams.get('phone')
    if (!id || !phone) return fail('id and phone are required')
    const existing = await db.address.findUnique({ where: { id } })
    if (!existing || existing.phone !== phone.trim()) return fail('Address not found', 404)
    await db.address.delete({ where: { id } })
    // Promote the most recent remaining address if we removed the default.
    if (existing.isDefault) {
      const next = await db.address.findFirst({ where: { phone: phone.trim() }, orderBy: { createdAt: 'desc' } })
      if (next) await db.address.update({ where: { id: next.id }, data: { isDefault: true } })
    }
    return ok({ deleted: id })
  })
}
