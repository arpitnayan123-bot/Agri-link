import { db } from '@/lib/db'
import { ok } from '@/lib/api-helpers'

export async function GET() {
  const farmers = await db.farmer.count()
  const products = await db.product.count()
  return ok({ status: 'healthy', service: 'AgriLink', farmers, products, time: new Date().toISOString() })
}
