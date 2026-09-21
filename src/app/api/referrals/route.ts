import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, ok, fail } from '@/lib/api-helpers'
import { REFERRAL_CREDIT_RS, referralCodeFor } from '@/lib/agrilink-client'

// Referral program — "Grow the movement":
//   GET  /api/referrals?phone=...             → your code + invites + earnings
//   POST /api/referrals { code, phone }       → apply a friend's code → ₹50
//                                               wallet credit (once per buyer)
//
// The code is derived deterministically from the inviter's phone, so invitees
// can redeem even when the inviter has never opened this device. ₹50 is
// platform-funded — farmer payouts are untouched.

export async function GET(req: NextRequest) {
  return guard(async () => {
    const phone = req.nextUrl.searchParams.get('phone')
    if (!phone || phone.trim().length < 6) return fail('phone is required')
    const clean = phone.trim()
    const invites = await db.walletTx.count({ where: { phone: clean, type: 'REFERRAL' } })
    const sum = await db.walletTx.aggregate({ where: { phone: clean, type: 'REFERRAL' }, _sum: { amountRs: true } })
    return ok({ code: referralCodeFor(clean), invites, earnedRs: sum._sum.amountRs ?? 0 })
  })
}

export async function POST(req: NextRequest) {
  return guard(async () => {
    const body = (await req.json().catch(() => ({}))) as { code?: string; phone?: string }
    const applicant = body.phone?.trim()
    const code = body.code?.trim().toUpperCase()
    if (!applicant || applicant.length < 6) return fail('phone is required')
    if (!code) return fail('code is required')
    if (code === referralCodeFor(applicant)) return fail('That is your own code 🙂')

    // Resolve the inviter: derive codes for every known buyer phone and match.
    const orders = await db.order.findMany({ select: { buyerPhone: true }, distinct: ['buyerPhone'] })
    const knownPhones = [...new Set(orders.map((o) => o.buyerPhone))]
    const inviter = knownPhones.find((p) => referralCodeFor(p) === code)
    if (!inviter) return fail('That referral code is not valid')

    const already = await db.walletTx.count({ where: { phone: applicant, type: 'REFERRAL' } })
    if (already > 0) return fail('Referral credit already claimed on this number')

    await db.walletTx.create({
      data: { phone: applicant, type: 'REFERRAL', amountRs: REFERRAL_CREDIT_RS, note: `Referral bonus · ${code}`, ref: code },
    })
    await db.notification.create({
      data: {
        phone: applicant,
        kind: 'WALLET',
        icon: '🎁',
        title: `₹${REFERRAL_CREDIT_RS} referral bonus added`,
        body: `Welcome to the movement! ${REFERRAL_CREDIT_RS} was credited to your AgriLink wallet — spend it on your first farmer-direct basket.`,
      },
    })
    return ok({ credited: REFERRAL_CREDIT_RS, code })
  })
}
