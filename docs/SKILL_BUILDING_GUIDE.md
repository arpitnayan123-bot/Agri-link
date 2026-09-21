# BhoomiDirect — Learn & Earn / KVK Skill Building Guide

How the Learn & Earn loop works, how to build the content pipeline with Krishi Vigyan Kendras (KVKs), and the exact JSON contract for new skill cards.

---

## 1. How Learn & Earn works (as coded)

**The loop: watch a 2–3 minute micro-lesson → unlock a badge → earn 5% cashback on your next order.** The cashback is **platform-subsidized**: it is charged to the 15% platform fee budget (which funds gateway, animation hosting and skill curation — see `payments.ts`), never deducted from the farmer's price.

Code path, step by step:

1. **Browse** — `GET /api/skills?crop=TOMATO` returns skill cards (concrete crop + always `GENERAL` cards), ordered crop → duration, each with `_count.watches` social proof.
2. **Watch & unlock** — `POST /api/skills/watch` with `{ skillId, buyerRef, unitPrice? }`:
   - `buyerRef` is the consumer identity (demo = phone string; prod = userId).
   - Creates a `SkillWatch` row (deduped per `skillId`+`buyerRef` — repeat calls return `alreadyWatched: true`, still idempotent).
   - Returns the **badge** (`skill.badge`) and a per-unit cashback quote (`unitPrice × cashbackPct / 100`).
3. **Buy with the badge** — at `POST /api/orders`, send `skillWatched: true` (and optionally `skillBadge`). The order then applies:
   - `cashbackRs = 5% × goodsRs` (full basket value — larger than the per-unit quote above),
   - `skillBadge` stored on the order (defaults to `SOIL_HEALTH_SCOUT` if not named),
   - consumer total = goods + 15% platform + 1.5% UPI + logistics − cashback. The farmer still receives `goodsRs` in full, instantly.

> MVP honesty notes: the order endpoint **trusts** the client's `skillWatched` flag (no server-side proof-of-watch check yet); there is no admin endpoint to add skills (cards are seeded from `src/lib/bhoomi-seed.ts`); the `lang` query param documented on `GET /api/skills` is not implemented. All three are on the roadmap.

**Badge taxonomy (allowed values, enforced by convention in seed + UI):**

| Badge | Lesson theme |
|---|---|
| `SOIL_HEALTH_SCOUT` | Reading soil/leaf symptoms, vermicompost, nutrient deficiency |
| `PEST_WARRIOR` | Neem/IPM sprays, early-warning scouting (late blight, thrips) |
| `WATER_WIZARD` | Drip scheduling, mulching, water saving |
| `FRESH_KEEPER` | Post-harvest: curing onions, the 4-hour rule for leafy greens |
| `RIPENESS_PRO` | Maturity indices (e.g. Alphonso shoulder-fill/float test) |

---

## 2. Partnering with Krishi Vigyan Kendras (KVKs)

### What KVKs are

KVKs are the **farm-science outreach centres of the Indian Council of Agricultural Research (ICAR)** network — one per district (~730+ nationally), each run by an agricultural university / NGO / state dept host, staffed by subject-matter specialists. They already do exactly what our lessons need: farmer training, on-farm demonstrations, and vernacular extension material. They are government-adjacent (public funded), so their brand carries the **credibility** our trust product needs — and a "KVK-verified" alignment matches the `kvkVerified` badge already on the Farmer model.

### How to approach (use the hierarchy, don't spam individual KVKs)

1. **Go zonal first, not KVK-by-KVK.** KVKs are administered through **11 ATARIs** (Agricultural Technology Application Research Institutes — the zonal ICAR coordinating bodies). State training is coordinated by **SAMETIs** (State Agricultural Management & Extension Training Institutes). A single MoU/nod with the ATARI (zone: e.g. ATARI Pune covers Maharashtra; ATARI Ludhiana covers Punjab) gets you a sanctioned pipeline to dozens of KVKs.
2. **Ask for the least-costly thing first:** review + co-brand a 2-minute lesson, not a video-production program. KVKs say yes to review; they balk at production burden.
3. **Pilot with 3 KVKs** (one per crop cluster): KVK Jalgaon (tomato), KVK Sangrur (spinach/potato), KVK Ratnagiri (mango) — these match the seeded `provider` values so existing data and new data stay coherent.
4. **Offer the value back:** show KVK officers the `_count.watches` analytics dashboard — reach measurement they currently lack — and name them `provider` on every card (attribution is built into the schema).

### Content co-creation workflow

```
KVK specialist script (2-min lesson, EN+HI draft)
        │
        ▼
Farmer-demonstrator video  ── filmed ON a BhoomiDirect farm, the FARMER demonstrates,
        │                     not an officer (trust transfer + farmer stardom)
        ▼
Technical review (KVK) + vernacular QA (native HI/MR/PA speaker)  ── both sign off
        │
        ▼
JSON skill card (schema below) submitted → platform review → versioned ingestion
        │
        ▼
Card goes live on GET /api/skills → watch unlocks badge → 5% cashback
```

Rules of thumb baked into the workflow: one learning point per card; demo, don't lecture ("30-second leaf check", "the float test"); 2–3 minutes (`durationMin`); the farmer demonstrator's own plot must appear in the video (links the lesson to the living-haat farm the consumer can see).

### Skill-card JSON schema (the KVK partner contract)

This is the **exact shape of the `Skill` model** (`prisma/schema.prisma`) that `GET /api/skills` serves. Today cards are seeded from `src/lib/bhoomi-seed.ts`; the ingestion path for partners (platform POST endpoint or partner-hosted feed polled at deploy) is roadmap item — this schema is the stable contract either way.

| Field | Type | Required | Rules |
|---|---|---|---|
| `crop` | string | ✅ | One of `TOMATO` `SPINACH` `ONION` `POTATO` `MANGO` or `GENERAL` |
| `title` | string | ✅ | ≤ 60 chars, action-first ("Spot nitrogen deficiency in tomato") |
| `titleHi` | string | ✅ | Hindi translation of title (devanagari) |
| `summary` | string | ✅ | ≤ 120 chars, the hook + what you'll learn |
| `summaryHi` | string | ✅ | Hindi translation of summary |
| `videoUrl` | string | ⬜ | Platform-hosted file key; MVP seeds use `kvk://skills/<badge>.mp4` placeholders |
| `durationMin` | int | ⬜ | Default `2`; keep 2–3 |
| `badge` | string | ✅ | One of the 5 allowed badges (table above) |
| `cashbackPct` | float | ⬜ | Default `5` — platform sets it; partners should leave as-is |
| `provider` | string | ⬜ | Default `"KVK"`; use e.g. `"KVK Jalgaon"` (attribution, shown in UI) |
| `lang` | string | ⬜ | Default `"hi"`; primary spoken language of the video (`hi`/`en`/`mr`/`pa`) |

### Sample JSON — 2 new cards

```json
[
  {
    "crop": "TOMATO",
    "title": "Stake and prune tomato in 90 seconds",
    "titleHi": "टमाटर में स्टेकिंग और प्रूनिंग 90 सेकंड में",
    "summary": "Farmer Sunita shows the single-stake method that cut her leaf-curl losses this season.",
    "summaryHi": "किसान सुनीता दिखाती हैं एक-स्टेक विधि जिसने इस मौसम लीफ-कर्ल नुकसान घटाया।",
    "videoUrl": "kvk://skills/staking_pruning_tomato.mp4",
    "durationMin": 2,
    "badge": "PEST_WARRIOR",
    "cashbackPct": 5,
    "provider": "KVK Jalgaon",
    "lang": "mr"
  },
  {
    "crop": "POTATO",
    "title": "Grade potatoes like a grader machine",
    "titleHi": "आलू की मशीन जैसी ग्रेडिंग खुद करें",
    "summary": "Three jute-bag sizes, one hand test — Gurpreet's trick for 20% better mandi-or-direct price.",
    "summaryHi": "तीन जूट बोरी, एक हाथ से जांच — गुरप्रीत की तरकीब से 20% बेहतर दाम।",
    "videoUrl": "kvk://skills/potato_grading.mp4",
    "durationMin": 3,
    "badge": "FRESH_KEEPER",
    "cashbackPct": 5,
    "provider": "KVK Ludhiana",
    "lang": "pa"
  }
]
```

---

## 3. Governance

- **Review gate (two-key):** no card goes live without (a) KVK technical sign-off and (b) platform agronomy review. Rejections must state a fixable reason (wrong dosage, unsafe advice, unverifiable claim).
- **Versioning:** cards are immutable once live. A change = new version row with `title@v2` semantics in the ingestion log; watched badges keep their original definition (a badge earned under v1 is not retroactively invalidated). If advice is found **unsafe**, the card is deactivated (filter at `GET /api/skills`) and a correction card is issued; existing watchers get the corrected summary via the platform channel.
- **Vernacular QA:** native-speaker check for Hindi **and** the source language (Marathi/Punjabi scripts often get machine-flattened); mandatory glossary alignment with ICAR/extension terminology (e.g. "नीम छिड़काव" not "नीम स्प्रे" in formal copy); numbers in Devanagari for HI, Gurmukhi numerals avoided (use Latin digits for dosage figures — a safety choice).
- **Attribution & analytics:** `provider` is always displayed; quarterly report back to the ATARI/MoU partner: watches per card, completion proxy (watch → order conversion), and farmer-side adoption of the taught practice seen in chain logs.
- **Badge integrity:** cashback is the same 5% regardless of badge — badges are achievement identity, not coupons. Never let partners fund "higher cashback" cards; that would turn agronomy into an ad auction.
