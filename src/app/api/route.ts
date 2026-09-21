import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'AgriLink API — farmer-direct quick commerce',
    version: '1.0.0',
    endpoints: [
      'GET  /api/health',
      'POST /api/seed',
      'GET  /api/products?category=&q=&recs=id1,id2',
      'GET  /api/stats',
      'GET  /api/orders?phone=',
      'POST /api/orders  (instant per-farmer payout, coupons/tip/wallet)',
      'POST /api/orders/[code]  (CANCEL → reversals + wallet refund | ISSUE)',
      'POST /api/ai/chat  (AgriLink AI assistant)',
      'POST /api/ai/search (natural-language search)',
      'GET  /api/reviews?productId= (blended rating)',
      'POST /api/reviews (buyer review)',
      'POST /api/farmers/follow (server-counted followers)',
      'GET  /api/coupons (coupon book)',
      'GET|POST|DELETE /api/addresses (saved address book)',
      'GET  /api/wallet?phone= (balance + signed ledger)',
      'GET|POST /api/notifications (bell inbox + mark read)',
      'GET|POST /api/referrals (AGR-XXXXXX code, ₹50 credit)',
      'GET|POST /api/subscription (SKIP | CANCEL | RESUME)',
    ],
  })
}
