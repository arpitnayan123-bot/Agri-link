import { guard, ok } from '@/lib/api-helpers'
import { couponList } from '@/lib/agrilink-client'

// GET /api/coupons — the live coupon book (platform-subsidized; farmer payout
// is never reduced). Client + server share the same PROMOS table, so what the
// UI advertises here is exactly what POST /api/orders validates at pay time.

export async function GET() {
  return guard(async () => ok(couponList()))
}
