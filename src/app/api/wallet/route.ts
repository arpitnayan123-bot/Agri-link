import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, ok, fail } from '@/lib/api-helpers'

// GET /api/wallet?phone=+91... — AgriLink wallet: balance + recent ledger.
// amountRs is SIGNED (+credit / −spend); balance = Σ amountRs.

export async function GET(req: NextRequest) {
  return guard(async () => {
    const phone = req.nextUrl.searchParams.get('phone')
    if (!phone || phone.trim().length < 6) return fail('phone is required')
    const txs = await db.walletTx.findMany({
      where: { phone: phone.trim() },
      orderBy: { createdAt: 'desc' },
      take: 25,
    })
    const agg = await db.walletTx.aggregate({ where: { phone: phone.trim() }, _sum: { amountRs: true } })
    return ok({ balanceRs: agg._sum.amountRs ?? 0, txs })
  })
}
