# BhoomiDirect — Next Steps Checklist (post-MVP)

Roadmap after the committed MVP backend (15 route files / 17 handlers, mocked integrations). Grouped by workstream; each item is actionable and references where it plugs into the existing code. ~10 workstreams (a–j).

---

## (a) Real ISRO Bhuvan / VEDAS NDVI integration

- [ ] Register for Bhuvan / VEDAS API access; capture farm polygons (lat/lng already on Farmer; add polygon per Farm)
- [ ] Replace `expectedNdvi`/`nextNdvi` simulation in `src/lib/growth.ts` with a cached NDVI fetcher (per-farm, daily cron; keep stage bands `stageFromNdvi` unchanged — they are the contract)
- [ ] Cloud-gap handling: fall back to last-good reading + flag `ndviSource: MOCK|BHUVAN`
- [ ] Farmer photo verification gate when satellite vs photo disagree (see RISK-REGISTER R4)
- [ ] A/B: keep mock feed for demo env via `NDVI_PROVIDER=mock|bhuvan` env switch
- [ ] Acceptance: real NDVI drives `stage` for one pilot farm for 2 weeks; stage changes anchor to BhoomiChain exactly as the mock does today (`STAGE_ADVANCE`)

## (b) Real Razorpay Route/X + RBI PA/PG compliance

- [ ] Legal: PA/PG authorization path (online PA), nodal/escrow account vs current-account instant-payout decision — document the choice against `payments.ts` assumptions
- [ ] Replace `mockUpiRef` consumer charge with Razorpay Orders/Checkout (keep `upiRef` column semantics)
- [ ] Replace `mockRazorpayXPayout` with RazorpayX Payouts API; add webhook handler route for `payout.processed` / `payout.failed` — extend order state to cover payout-failure (current state machine assumes always-processed)
- [ ] Idempotency keys on `POST /api/orders`; signed-webhook verification middleware
- [ ] Per-farmer payout caps + velocity limits + T+2 hold-back for new farmers (R3)
- [ ] Reconciliation job: orders ↔ settlements ↔ payout UTRs
- [ ] Acceptance: end-to-end ₹1 test payout to a real farmer VPA with webhook-confirmed `processed`

## (c) Shadowfax/Delhivery rural API + webhook live tracking

- [ ] Partner MoU + sandbox keys (Shadowfax Rural / Delhivery); map rate card onto `logisticsCost()` (replace the ₹2.5/₹5 constants with per-pincode rates; keep ₹35 floor logic configurable)
- [ ] Book-shipment call on order creation → real AWB replaces `mockTrackingId()`
- [ ] Inbound webhook route translating partner scans into the existing `OrderEvent` stream (`LOGISTICS_ASSIGNED → OUT_FOR_DELIVERY → DELIVERED`) — keep `POST /api/orders/:id/advance` as the manual fallback
- [ ] Cold-chain SLA instrumentation for MANGO orders (temperature events → consumer-visible timeline)
- [ ] Acceptance: one live rural shipment tracked from farm gate to doorstep with partner scans

## (d) Aadhaar OTP + face liveness KYC

- [ ] Integrate Aadhaar OTP (eAadhaar/UAI-compliant provider) + face liveness; issue consent artifact (DPDP)
- [ ] Replace seeded `aadhaarHash = computeHash(...)` construction in `bhoomi-seed.ts` with real enrollment hash flow; keep "never store raw Aadhaar" invariant (schema stores hash only)
- [ ] Server-side `kycVerified` transition only after provider webhook, not client flag
- [ ] Re-audit `GET /api/farms/:id` response trimming (currently returns full farmer object incl. phone/upiId/aadhaarHash)
- [ ] Acceptance: a new farmer completes KYC end-to-end without platform staff touching data

## (e) WhatsApp OTP consumer auth

- [ ] WhatsApp Business Platform (BSP) OTP flow; issue short-lived sessions
- [ ] `buyerPhone` becomes verified identity on `POST /api/orders`; `SkillWatch.buyerRef` migrates from demo phone-string to userId
- [ ] Order status notifications via WhatsApp (payment + payout proof, out-for-delivery, delivered)
- [ ] Acceptance: OTP-verified checkout on a 2G connection under 30s

## (f) Real Lottie animation pipeline from farmer time-lapse clips

- [ ] Capture protocol for farmers (fixed tripod angle, weekly shot, WhatsApp file handoff)
- [ ] Pipeline: clip → rotoscope/vectorize → 6-stage SVG/Lottie asset per crop (~<10 KB/stage) → CDN
- [ ] Wire stage-swap animation to `stageFromNdvi` transitions (already the UI contract)
- [ ] Keep payload budget: full animated farm view < 200 KB; `prefers-reduced-motion` respected
- [ ] Acceptance: one real farm's season rendered as its living-haat animation

## (g) ONDC network participant integration

- [ ] Register as seller-app NP; map Listing → ONDC catalog item (incl. per-farm fulfillment)
- [ ] Order mapping: ONDC confirm/on_update flows onto the existing order lifecycle (PAID_TO_FARMER state happens at ONDC payment capture)
- [ ] Logistics: honor ONDC logistics NLSP instead of direct Shadowfax where mandated
- [ ] Acceptance: first test order through ONDC sandbox against pilot listings

## (h) Voice-first USSD/IVR fallback for feature phones

- [ ] IVR (e.g. Exotel/Twilio-compatible) exposing farmer core flows: add chain log by voice (`POST /api/farms/:id/logs` from DTMF/speech), hear mandi price vs direct price, hear payout confirmation
- [ ] USSD short-code for balance + order status (pull from `GET /api/farmer/dashboard`)
- [ ] Voice-note ingestion already modeled (`voiceNoteUrl`, `voiceNoteLang`) — connect real audio upload
- [ ] Acceptance: Sunita adds an irrigation log and hears her lifetime earnings with no smartphone

## (i) Scale-out: Postgres/Aurora, CDN-cached animations, state expansion

- [ ] DATABASE_URL → Aurora Postgres; `prisma migrate` baseline; replace JSON-string columns (`costBreakdown`) with jsonb where beneficial
- [ ] Connection pooling (PgBouncer/Prisma Accelerate); read replica for the consumer storefront
- [ ] CDN for animation assets + farm photos; API response trimming + cache headers on `GET /api/farms` / `mandi-prices`
- [ ] Load test: 500 concurrent checkout reads, 50 writes/s order path
- [ ] Staged state expansion: MH+PB → 2 more states; supply onboarding ahead of demand (R7); multi-farmer/FPO aggregated listings
- [ ] Acceptance: p95 API < 300 ms at 3× pilot load

## (j) Impact measurement

- [ ] Farmer income-uplift dashboard: formalize `upliftVsMandiPct` / `farmerShareOfConsumerRs` (already computed in `GET /api/farmer/dashboard`) into a longitudinal per-farmer report (baseline = 12-month mandi series)
- [ ] Track: payout latency (target: instant), produce-freshness (order→delivery hours), spoilage rate, repeat-buyer rate, badge→practice adoption via chain logs
- [ ] Third-party audit: independent evaluation of farmer income uplift + chain-log integrity (spot-verify `verifyChain` against source records); publish methodology
- [ ] Acceptance: audited "farmer keeps ~84–88% vs 22–35% via mandi" claim with n>100 farmers
