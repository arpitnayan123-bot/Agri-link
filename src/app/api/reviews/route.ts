import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, ok, fail } from '@/lib/api-helpers'

// GET /api/reviews?productId=...  → reviews (BUYER first, newest first) + blended avg
export async function GET(req: NextRequest) {
  return guard(async () => {
    const productId = req.nextUrl.searchParams.get('productId')
    if (!productId) return fail('productId required')

    const [reviews, product] = await Promise.all([
      db.review.findMany({
        where: { productId },
        orderBy: [{ createdAt: 'desc' }],
        take: 50,
      }),
      db.product.findUnique({ where: { id: productId }, select: { rating: true } }),
    ])

    const buyerReviews = reviews.filter((r) => r.source === 'BUYER')
    const seedReviews = reviews.filter((r) => r.source !== 'BUYER')
    // Blended rating: catalog base weighted ×8 + every real buyer review.
    const base = product?.rating ?? 4.5
    const sumBuyer = buyerReviews.reduce((s, r) => s + r.rating, 0)
    const blended = (base * 8 + sumBuyer) / (8 + buyerReviews.length)

    return ok({
      reviews: [...buyerReviews, ...seedReviews],
      count: reviews.length,
      buyerCount: buyerReviews.length,
      avg: Math.round(blended * 10) / 10,
    })
  })
}

// POST /api/reviews { productId, name, rating, comment, buyerPhone?, orderCode?, lang? }
export async function POST(req: NextRequest) {
  return guard(async () => {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return fail('invalid body')
    const { productId, name, rating, comment, buyerPhone, orderCode, lang } = body as Record<string, unknown>

    if (typeof productId !== 'string' || !productId) return fail('productId required')
    const product = await db.product.findUnique({ where: { id: productId }, select: { id: true } })
    if (!product) return fail('unknown product')

    const nameStr = typeof name === 'string' ? name.trim() : ''
    if (nameStr.length < 2 || nameStr.length > 40) return fail('name must be 2-40 chars')

    const ratingNum = typeof rating === 'number' ? rating : Number(rating)
    if (!Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5) return fail('rating must be 1-5')

    const commentStr = typeof comment === 'string' ? comment.trim() : ''
    if (commentStr.length < 3 || commentStr.length > 500) return fail('comment must be 3-500 chars')

    const created = await db.review.create({
      data: {
        productId,
        name: nameStr,
        rating: Math.round(ratingNum * 2) / 2, // snap to 0.5 steps
        comment: commentStr,
        lang: lang === 'hi' ? 'hi' : 'en',
        source: 'BUYER',
        buyerPhone: typeof buyerPhone === 'string' && buyerPhone.trim() ? buyerPhone.trim() : null,
        orderCode: typeof orderCode === 'string' && orderCode.trim() ? orderCode.trim() : null,
      },
    })
    return ok(created)
  })
}
