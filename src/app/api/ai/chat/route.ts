import { NextRequest } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'
import { guard, ok, fail } from '@/lib/api-helpers'

type Msg = { role: 'user' | 'assistant'; content: string }

type SlimPick = {
  id: string
  name: string
  nameHi: string
  emoji: string
  unitLabel: string
  priceRs: number
  farmerName: string
  farmerAvatar: string
}

// POST /api/ai/chat — AgriLink AI assistant v2: recipes, basket building,
// freshness tips. Grounded in the live catalog; returns structured `picks`
// so the UI can render one-tap "Add all to basket".
//
// Constraints are enforced server-side:
//  - budget parsed from the user's message (₹X / under X / below X / के अंदर)
//  - the LLM must end with `PICKS: <id,...>` referencing real catalog ids
//  - picks that violate the parsed budget are dropped; if everything was
//    dropped we fall back to the freshest items within budget.
export async function POST(req: NextRequest) {
  return guard(async () => {
    const body = (await req.json()) as { messages?: Msg[] }
    const messages = (body.messages ?? []).filter((m) => m.content?.trim()).slice(-8)
    if (!messages.length) return fail('messages[] required')

    const products = await db.product.findMany({
      take: 30,
      orderBy: [{ isBestseller: 'desc' }, { rating: 'desc' }],
      include: { farmer: true },
    })
    const catalog = products
      .map(
        (p) =>
          `- [${p.id}] ${p.name} (${p.emoji}, ${p.unitLabel}, ₹${p.priceRs}, farmer ${p.farmer.name} of ${p.farmer.village}, category ${p.category}, freshness "harvested ${Math.round((Date.now() - p.harvestedAt.getTime()) / 3600_000)}h ago")`
      )
      .join('\n')

    const budget = parseBudget(messages[messages.length - 1].content)

    const system = `You are AgriLink AI, the friendly assistant of AgriLink — a farmer-direct quick-commerce app in India where verified farmers sell fresh, chemical-free produce directly to consumers and get paid instantly over UPI (no middlemen).

Rules:
- Recommend ONLY products from this live catalog (id, name, price, unit, farmer):
${catalog}
- Be concise: 2-5 short sentences or a tight list. Warm, helpful, never pushy.
- HARD RULE — respect the user's budget: if the user says "under ₹X", "below X", "₹X mein" or similar, you MUST only recommend items priced ≤ X (per unit). Never mention an item that costs more than their budget. If nothing fits, suggest the cheapest useful items and say so honestly.
- If asked for recipes: give a simple Indian recipe idea using catalog items, and list which items to ADD.
- If asked to build a basket: give item list with quantities and estimated total in ₹ (use catalog prices exactly).
- Mention the zero-middleman promise when relevant: farmers keep ~85% of every rupee, paid instantly.
- Reply in the user's language (English, Hindi, or Hinglish).
- Never invent products, prices, or promises outside the catalog.
- END your reply with exactly one final line: "PICKS: id1, id2, ..." — a comma-separated list of 2-6 catalog ids you recommended, in recommendation order. This line is machine-read; never skip it.`

    let reply = ''
    let source: 'llm' | 'heuristic' = 'heuristic'

    try {
      const zai = await ZAI.create()
      const completion = await zai.chat.completions.create({
        messages: [{ role: 'system', content: system }, ...messages],
        thinking: { type: 'disabled' },
      })
      reply = completion.choices[0]?.message?.content?.trim() ?? ''
      if (reply) source = 'llm'
    } catch (e) {
      console.error('[ai/chat]', e)
    }

    // Heuristic fallback reply when the LLM is unavailable.
    if (!reply) {
      const last = messages[messages.length - 1].content.toLowerCase()
      const matched = products
        .filter((p) => last.includes(p.name.toLowerCase().split(' ')[0]))
        .filter((p) => budget == null || p.priceRs <= budget)
        .slice(0, 3)
      reply = matched.length
        ? `Fresh picks for you: ${matched.map((p) => `${p.emoji} ${p.name} ₹${p.priceRs}/${p.unitLabel}`).join(' · ')}. Every farmer is paid instantly — no middlemen. Want a recipe with these?`
        : budget != null
          ? `Here are our freshest items under ₹${budget}: try the AI search above, or ask "Plan a ₹${budget} veggie basket".`
          : 'Try asking: "Plan a ₹300 veggie basket", "Dinner recipe from my basket", or "Today\'s freshest picks". I know every product, price and farmer on AgriLink!'
    }

    // ── Extract structured picks ────────────────────────────────────────────
    let pickIds: string[] = []
    const picksMatch = reply.match(/PICKS:\s*([A-Za-z0-9_,\s-]+)/i)
    if (picksMatch) {
      pickIds = picksMatch[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      reply = reply.replace(picksMatch[0], '').trim()
    }
    // Fallback: match product names mentioned in the reply text.
    if (pickIds.length === 0) {
      const lower = reply.toLowerCase()
      pickIds = products
        .filter((p) => lower.includes(p.name.toLowerCase().split(' ')[0]))
        .map((p) => p.id)
        .slice(0, 4)
    }

    const byId = new Map(products.map((p) => [p.id, p]))
    const seen = new Set<string>()
    let picks: SlimPick[] = pickIds
      .map((id) => byId.get(id))
      .filter((p): p is (typeof products)[number] => !!p)
      .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
      .map((p) => ({
        id: p.id,
        name: p.name,
        nameHi: p.nameHi,
        emoji: p.emoji,
        unitLabel: p.unitLabel,
        priceRs: p.priceRs,
        farmerName: p.farmer.name,
        farmerAvatar: p.farmer.avatar,
      }))

    // Enforce the budget server-side — the LLM sometimes strays.
    if (budget != null) {
      const within = picks.filter((p) => p.priceRs <= budget)
      if (within.length >= 2) {
        picks = within
      } else {
        // Fallback: freshest items within budget (respecting basket sanity).
        picks = products
          .filter((p) => p.priceRs <= budget)
          .sort((a, b) => a.priceRs - b.priceRs)
          .slice(0, 4)
          .map((p) => ({
            id: p.id,
            name: p.name,
            nameHi: p.nameHi,
            emoji: p.emoji,
            unitLabel: p.unitLabel,
            priceRs: p.priceRs,
            farmerName: p.farmer.name,
            farmerAvatar: p.farmer.avatar,
          }))
      }
    }
    picks = picks.slice(0, 6)

    return ok({ reply, picks, source, budget })
  })
}

function parseBudget(text: string): number | null {
  const t = text.toLowerCase().replace(/,/g, '')
  const patterns = [
    /₹\s*(\d{2,6})/,
    /(?:under|below|upto|up to|less than|max(?:imum)?)\s*(?:rs\.?|₹)?\s*(\d{2,6})/,
    /(\d{2,6})\s*(?:rs|rupees|रुपये)?\s*(?:me|mein|में|के अंदर|तक|ke andar|tak)/,
    /(?:budget|बजट)\s*(?:of|is|ः|:)?\s*(?:₹|rs\.?)?\s*(\d{2,6})/,
  ]
  for (const p of patterns) {
    const m = t.match(p)
    if (m) {
      const n = Number(m[1])
      if (Number.isFinite(n) && n >= 10 && n <= 100000) return n
    }
  }
  return null
}
