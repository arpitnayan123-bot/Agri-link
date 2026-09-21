import { db } from '@/lib/db'
import { guard, ok } from '@/lib/api-helpers'

// GET /api/stats — live trust numbers for the hero.
export async function GET() {
  return guard(async () => {
    const [farmers, products, orders, paidAgg, kgAgg] = await Promise.all([
      db.farmer.count(),
      db.product.count(),
      db.order.count(),
      db.order.aggregate({ _sum: { farmerPayoutRs: true, totalRs: true } }),
      db.orderItem.aggregate({ _sum: { qty: true } }),
    ])
    const paid = paidAgg._sum.farmerPayoutRs ?? 0
    const total = paidAgg._sum.totalRs ?? 0
    return ok({
      farmers,
      products,
      orders,
      paidToFarmersRs: paid,
      avgFarmerSharePct: total > 0 ? Math.round((paid / total) * 100) : 85,
      kgDelivered: kgAgg._sum.qty ?? 0,
    })
  })
}
