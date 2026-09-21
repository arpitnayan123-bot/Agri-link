import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, ok, fail } from '@/lib/api-helpers'

// POST /api/farmers/follow — server-counted follower hearts.
// Body: { farmerId: string, follow: boolean }
// Follows are per-visitor locally (zustand) but the counter is global so the
// social proof ("1.2k followers") is real for every visitor, not cosmetic.
export async function POST(req: NextRequest) {
  return guard(async () => {
    const body = (await req.json()) as { farmerId?: string; follow?: boolean }
    if (!body?.farmerId) return fail('farmerId is required')

    const farmer = await db.farmer.findUnique({ where: { id: body.farmerId } })
    if (!farmer) return fail('Farmer not found', 404)

    const follow = body.follow !== false
    const updated = await db.farmer.update({
      where: { id: body.farmerId },
      data: { followers: follow ? { increment: 1 } : { decrement: 1 } },
    })

    return ok({ farmerId: body.farmerId, followers: Math.max(0, updated.followers), following: follow })
  })
}
