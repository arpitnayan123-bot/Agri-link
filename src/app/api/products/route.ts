import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, ok } from '@/lib/api-helpers'
import type { Prisma } from '@prisma/client'

// GET /api/products?category=&q=&bestsellers=1&recs=id1,id2
export async function GET(req: NextRequest) {
  return guard(async () => {
    const sp = req.nextUrl.searchParams
    const category = sp.get('category') ?? 'ALL'
    const q = (sp.get('q') ?? '').trim()
    const recs = sp.get('recs')

    const where: Prisma.ProductWhereInput = {}
    if (category === 'BESTSELLERS') where.isBestseller = true
    else if (category !== 'ALL') where.category = category
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { nameHi: { contains: q } },
        { description: { contains: q } },
      ]
    }

    const products = await db.product.findMany({
      where,
      include: {
        farmer: true,
        _count: { select: { reviews: true } },
      },
      orderBy: [{ isBestseller: 'desc' }, { rating: 'desc' }],
    })

    // AI-style recommendations: complement categories + bestseller fill.
    if (recs) {
      const ids = recs.split(',').filter(Boolean)
      if (ids.length) {
        const cartItems = await db.product.findMany({ where: { id: { in: ids } } })
        const cartCategories = new Set(cartItems.map((p) => p.category))
        const cartIds = new Set(ids)
        const complements: Record<string, string[]> = {
          VEGETABLES: ['HERBS', 'LEAFY'],
          LEAFY: ['HERBS', 'VEGETABLES'],
          HERBS: ['VEGETABLES', 'LEAFY'],
          FRUITS: ['FRUITS'],
        }
        const wantCats = [...cartCategories].flatMap((c) => complements[c] ?? [])
        const picks = products
          .filter((p) => !cartIds.has(p.id) && wantCats.includes(p.category))
          .slice(0, 6)
        const fill = products
          .filter((p) => !cartIds.has(p.id) && !picks.some((k) => k.id === p.id) && p.isBestseller)
          .slice(0, 6)
        const merged = [...picks, ...fill].slice(0, 8)
        const withWhy = merged.map((p) => ({
          ...stripCount(p),
          why: p.isBestseller ? 'Crowd favourite' : 'Pairs with your basket',
        }))
        return ok(withWhy)
      }
    }

    return ok(products.map(stripCount))
  })
}

// Flatten the Prisma _count into a client-friendly reviewCount field.
function stripCount<T extends { _count?: { reviews: number } }>(p: T) {
  const { _count, ...rest } = p
  return { ...rest, reviewCount: _count?.reviews ?? 0 }
}
