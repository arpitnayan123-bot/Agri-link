# BhoomiDirect — Technology Justification

One page, five decisions. Each states what we chose, why, and what we honestly give up. Claims are grounded in the committed backend (`prisma/schema.prisma`, `src/lib/*`, `src/app/api/*`).

---

## 1. Next.js 16 full-stack vs React SPA + Fastify (the original brief suggested Fastify)

**Chosen:** one Next.js 16 App Router app — React frontend and `route.ts` API handlers in a single deployable.

| Factor | Next.js 16 all-in-one | React + Fastify (two services) |
|---|---|---|
| Deploy surface | 1 artifact, 1 port, 1 log stream | 2 artifacts, CORS, reverse-proxy, 2 CI pipelines |
| Data fetching | React Server Components + route handlers share TypeScript types & Prisma client directly | HTTP contract between SPA and API; duplicated DTO types |
| Time-to-first-demo | Minutes (this repo's 15 route files, zero boilerplate) | Slower — worth it only at team scale |
| Sandbox constraint | The evaluation sandbox runs **one** Node process per app; a second Fastify process (like the old AgriLink socket.io mini-service) adds port/gateway plumbing | N/A |
| Long-run headroom | Modular-monolith: route handlers are thin, business logic lives in `src/lib` (pure TS: `payments.ts`, `chain.ts`, `growth.ts`) | Better story for independent scaling of API tier |

**Honest trade-off:** Next.js API routes are not the thinnest possible HTTP layer (middleware/auth, per-route cold starts under self-hosting, no built-in schema validation — we hand-roll checks today). But the API layer is deliberately **framework-agnostic**: handlers only call `db` + pure libs and return JSON via two helpers (`ok`/`fail` in `api-helpers.ts`). Porting to Fastify is mechanical: move `src/lib/*` unchanged, re-express each `route.ts` as a Fastify route, swap `NextResponse.json` for `reply.send` (~a day for all 17 handlers). Node's event loop handles concurrent UPI webhook/callback traffic well (I/O-bound, thousands of concurrent connections per core); CPU-heavy work (NDVI raster crunching) belongs in a separate worker service regardless of web framework — that is the actual trigger to split, not traffic.

**Verdict:** monolith-first now, strangler-pattern split later when a boundary earns it.

## 2. SQLite now → PostgreSQL/Aurora later

- **Now:** single-file zero-ops DB matches the sandbox and the demo (5 farmers, a handful of orders). Prisma makes the schema provider-portable; SQLite limitations are known and coded around (no native enums/arrays → string columns like `stage`, JSON-in-text like `costBreakdown`).
- **Trigger to move:** concurrent writers (farmers + consumers + logistics callbacks), row-level access control, analytics aggregation, >1 app instance. 
- **Later:** PostgreSQL/Aurora with PITR, read replicas for the consumer storefront, Prisma migrate for zero-downtime changes. The 9-model schema carries over nearly verbatim; expect rewrites only for raw JSON-string queries and the `ChainLog` hash-verification scans (add `(farmId, at)` — already indexed — plus periodic anchor tables).

## 3. Lightweight SVG+CSS "Lottie-style" animations, not Three.js

The product promise is *watch your field grow* — but the consumer is often on 2G/3G in tier-3 towns. Budget: **< 200 KB total payload** for the animated farm view.

| Option | Cost | Fit |
|---|---|---|
| Three.js scene | ~600 KB JS + GLSL learning curve + heavy GPU | Fails on 2G and low-end Androids |
| Full Lottie JSONs | ~50–300 KB per animation, player ~60 KB | Good, but heavy authoring pipeline |
| **SVG + CSS keyframe stage transitions** (chosen) | ~2–10 KB per crop stage, zero JS runtime | Scales to 6 stages × 5 crops; respects `prefers-reduced-motion`; cacheable CDN assets |

The NDVI number already drives which stage renders (`stageFromNdvi`), so "animation" is a cheap stage-swap plus CSS growth tweens. Time-lapse video of the *real* field stays behind a lazy-loaded tap (rural upload cost is on the farmer's side, kept optional).

## 4. Mock Razorpay X semantics now; what production requires

**Why mock:** payouts must be provably *instant* in demos (the entire trust story), but real disbursal needs KYC'd merchant accounts, and testing chargeback/rollback paths with real rupees is not possible in a sandbox. The mock (`mockRazorpayXPayout`) emits the exact response shape production code will bind to: `{ id, status: "processed", utr, mode }`.

**Production integration requirements:**

1. **Razorpay Route / RazorpayX Payouts** — Route for splitting consumer payments at capture time; X Payouts API for UPI/IMPS disbursal to farmer VPAs with webhook confirmation (`payout.processed`) instead of instant `processed`.
2. **RBI PA/PG guidelines (2025 direction on Aggregator Payments)** — online PA authorization, segregation of customer funds from own funds, escrow-type account with a scheduled bank, daily settlement reporting.
3. **Nodal/escrow account vs instant payout — the real trade-off:** a nodal/escrow model (collect → hold → settle T+1) is regulatorily safest but breaks the "farmer paid the second you pay" promise; Razorpay X instant payouts from the current account keep the promise but require the platform to pre-fund and to own payout-failure/chargeback risk. MVP choice to validate: **instant payout, consumer bears all fees** — revisit per RBI compliance counsel (see RISK-REGISTER R3).
4. Also required: signed webhook verification, idempotency keys on `/api/orders`, reconciliation ledger, payout retry/rollback state (real UPI payouts can fail after the order is placed — the mock always says `processed`).

## 5. India-first constraints → design responses

| Constraint | Design response in code/docs |
|---|---|
| **Low bandwidth (2G/3G)** | SVG+CSS animations < 200 KB; JSON-only API with tight includes; latest-50 cap on order lists; video assets lazy/optional |
| **Vernacular (Hindi/Marathi/Punjabi)** | Bilingual columns in the data model itself: `bio`+`bioHi`, `title`+`titleHi`, `summary`+`summaryHi`; farmer voice notes tagged `voiceNoteLang` (`hi`/`en`/`mr`/`pa`); chain-log activity labels ship EN+HI (`chain.ts ACTIVITY_LABELS`) |
| **UPI dominance** | Settlement is UPI-first (`farmer.upiId` VPA), consumer fee line explicitly named "UPI fee"; UPI fee modeled at 1.5% test semantics |
| **Intermittent power / connectivity** | Stateless request handlers (any node serves any request), single-file DB for kiosk/offline demos, idempotent re-seed, hash-chain verifiable offline once data is fetched |
| **Trust deficit (middlemen history)** | Honesty UI data shipped by API: `mandiPricePerKg` shown next to direct price, `inputCostPerKg` + `costBreakdown`, `farmerSharePct` computed per order, tamper-evident BhoomiChain with consumer-visible `chain.valid`, instant-payout proof (`payout.id`/`utr`) in the order response |

## 6. What is mocked (full honesty table)

| Subsystem | MVP reality | Production path |
|---|---|---|
| **ISRO Bhuvan / VEDAS NDVI** | Logistic curve per crop (`expectedNdvi`, `nextNdvi` in `growth.ts`); stage bands hard-coded | Bhuvan WMS/VEDAS tile or NDVI API, cached per farm polygon; fallback to farmer photo verification |
| **Razorpay X payout** | `mockRazorpayXPayout()` — generated `payout_…`/`UTR…`, always `processed` | Razorpay Route/X + PA/PG-compliant nodal or current-account model (§4) |
| **Shadowfax Rural logistics** | Fixed `SHADOWFAX_RURAL` partner, generated `SFR…` AWB, `/advance` simulates scans | Partner rate-card + webhook → maps 1:1 onto the existing `LOGISTICS_ASSIGNED → OUT_FOR_DELIVERY → DELIVERED` events |
| **Agmarknet mandi prices** | 9 hand-authored rows with `trendPct` | Agmarknet/ehoscraper daily job into the existing `MandiPrice` model |
| **Aadhaar KYC + liveness** | `aadhaarHash = sha256(...)` of demo numbers; boolean `kycVerified` | Aadhaar OTP (eAadhaar/UAI) + face liveness; store **hash only** (DPDP Act 2023) |
| **WhatsApp OTP consumer auth** | None — `buyerPhone` trusted after regex | WhatsApp Business API OTP; phone becomes the verified identity on `Order.buyerPhone`/`SkillWatch.buyerRef` |
| **KVK skill feed** | 8 seeded cards with `kvk://…` video placeholders | KVK partners POST/serve the JSON card schema (docs/SKILL_BUILDING_GUIDE.md) |
| **BhoomiChain** | Local sha256 per-farm hash chain, verified on read (`verifyChain`) | Batch-merkle-anchor to Polygon PoS; keep local chain for instant UX |

**Not mocked / actually real:** the full data model, hash-chain math (real sha256 via Node `crypto`), payment arithmetic (`computeBreakdown`), state machines (order lifecycle, NDVI stages), stock decrement, farmer lifetime-earnings ledger, and all 17 API handlers.
