import { seed } from '@/lib/agrilink-seed'
import { guard, ok } from '@/lib/api-helpers'

// POST /api/seed — reseed the demo catalog (dev utility).
export async function POST() {
  return guard(async () => {
    await seed()
    return ok({ seeded: true })
  })
}

export async function GET() {
  return guard(async () => {
    await seed()
    return ok({ seeded: true })
  })
}
