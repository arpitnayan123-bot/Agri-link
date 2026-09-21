import { NextRequest } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'
import { guard, ok } from '@/lib/api-helpers'
import type { Prisma } from '@prisma/client'

// POST /api/ai/search — natural-language smart search.
// "something green for salad" → leafy items. LLM extracts keywords; falls back
// to substring matching so it always returns something useful.
export async function POST(req: NextRequest) {
  return guard(async () => {
    const { q } = (await req.json()) as { q?: string }
    const query = (q ?? '').trim()
    if (!query) return ok([])

    const products = await db.product.findMany({ include: { farmer: true } })

    let keywords = [query]
    try {
      const zai = await ZAI.create()
      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content:
              'Extract 1-4 simple food search keywords from the user query. Reply with comma-separated keywords ONLY. Examples: "something for salad" → "cucumber, spinach, tomato"; "मीठा फल" → "mango, banana, guava"; "make paneer dish" → "spinach, tomato, onion".',
          },
          { role: 'user', content: query },
        ],
        thinking: { type: 'disabled' },
      })
      const raw = completion.choices[0]?.message?.content?.trim()
      if (raw) keywords = raw.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean).slice(0, 4)
    } catch (e) {
      console.error('[ai/search]', e)
    }

    const lower = query.toLowerCase()
    const scored = products.map((p) => {
      const hay = `${p.name} ${p.nameHi} ${p.category} ${p.description}`.toLowerCase()
      let score = 0
      for (const k of keywords) if (hay.includes(k)) score += 2
      if (hay.includes(lower)) score += 3
      for (const w of lower.split(/\s+/)) if (w.length > 2 && hay.includes(w)) score += 1
      return { p, score }
    })
    const hits = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((s) => s.p)

    if (hits.length) return ok(hits)

    // Last resort: bestsellers so the user still sees something shoppable.
    return ok(products.filter((p) => p.isBestseller).slice(0, 6))
  })
}
