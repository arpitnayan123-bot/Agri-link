# AgriLink v2 — API Reference

**Version 1.0.0** · Base URL: `http://localhost:3000`
Ground truth: `src/app/api/**/route.ts` (8 route files, 9 HTTP handlers), `src/lib/api-helpers.ts`, `src/lib/agrilink-client.ts` (shared bill math).

Postman tour: `postman/AgriLink.postman_collection.json`.

---

## 1. Conventions

### Response envelope

Handlers return raw JSON data via `ok()` / `fail()` (`src/lib/api-helpers.ts`):

```jsonc
// success — HTTP 200
{ "...payload" }

// error — HTTP 400 (validation) or 500
{ "ok": false, "error": "Only 12 500 g of Spinach (Palak) left" }
```

`GET /api` (root index) returns `{ ok, service, version, endpoints[] }` directly.

### Auto-seed

Handlers (except `/` and `/api/health`) auto-seed the database on the first request of a process when the tables are empty (`src/lib/agrilink-seed.ts`): 7 farmers (MH+PB, stories EN/HI, UPI ids, KYC) × 22 products (category, emoji, price/mrp/mandi price, harvestedAt offsets, stock, accents) + 5 demo orders with per-farmer payout refs.

Force a clean reseed: `POST /api/seed`.

### Auth model (demo — no authentication)

Orders are keyed by `buyerPhone` (the consumer "identity"). Production would use OTP/NextAuth; the payout engine is unaffected.

---

## 2. Endpoints

### GET /api

Route index with the endpoint list.

### GET /api/health

```json
{ "status": "healthy", "service": "AgriLink", "farmers": 7, "products": 22, "time": "..." }
```

### POST /api/seed

Force reseed (wipes + recreates demo data). Returns counts.

### GET /api/stats

Live totals powering the ticker/hero:

```json
{ "farmers": 7, "products": 22, "orders": 9, "paidToFarmersRs": 2901, "avgFarmerSharePct": 93, "kgDelivered": 28 }
```

### GET /api/products

Query params: `category` (`ALL`|`BESTSELLERS`|`VEGETABLES`|`LEAFY`|`HERBS`|`FRUITS`), `q` (substring over name/nameHi/description), `recs=id1,id2`.

- Without `recs`: all matching products, bestsellers first, then rating. Each product embeds its full `farmer` object.
- With `recs`: "AI's picks for your basket" — complement-category recommendations for the cart ids (VEGETABLES↔HERBS/LEAFY etc.), backfilled with bestsellers; each item gains `why`.

### GET /api/orders?phone=

Order book for a buyer (all orders when no phone). **Auto-advances the lifecycle**: any non-DELIVERED order whose age crosses the demo clock (`STAGE_MS = 150 s` per stage, DB-persisted) moves PAID → PACKED → OUT_FOR_DELIVERY → DELIVERED. **Slot-aware gating**: scheduled orders (`slotKey ≠ EXPRESS`) only start the clock when their delivery window opens (demo offsets: TODAY_EVE +4 min, TODAY_NIGHT +8 min, TMR_MORN +12 min, TMR_EVE +16 min — production would use real window timestamps). Until then the order stays PAID and the response carries `awaitingWindow: true` with `nextStageInMin` = minutes until harvest begins. Items carry per-farmer `payoutRef` proofs.

### POST /api/orders

The zero-middleman moment. Request:

```json
{
  "buyerName": "Anjali Sharma",
  "buyerPhone": "9876543210",
  "buyerCity": "Pune",
  "address": "Flat 402, Kalyani Nagar, Pune 411006",
  "promoCode": "FRESH10",
  "slotKey": "TODAY_EVE",
  "subscription": "WEEKLY",
  "tipRs": 20,
  "useWallet": true,
  "items": [{ "productId": "…", "qty": 2 }]
}
```

`slotKey` is optional (default `EXPRESS`) and server-whitelisted against: `EXPRESS | TODAY_EVE | TODAY_NIGHT | TMR_MORN | TMR_EVE` — unknown values fall back to `EXPRESS` (scheduled slots set `etaMin` to 240 and the UI renders the localized window, e.g. "Today · 5–8 PM").

`subscription` is optional and whitelisted against `WEEKLY` (5% of items, cap ₹150, **platform-subsidized**, stacks with promos). Subscribing stores `subscription: "WEEKLY"` + `nextDeliveryAt` (now + 7 days) on the order; unknown values are rejected.

`tipRs` is optional and whitelisted against `0 | 10 | 20 | 30 | 50` — **100% passes through to the delivery partner**; it is added to the bill after discounts and included in `totalRs`.

`useWallet` is optional — when true, the server sums the buyer's signed `WalletTx` ledger, applies `min(balance, bill)` as `walletUsedRs`, records a negative `SPEND` entry, and reduces `totalRs` accordingly.

Coupons share the client/server `PROMOS` table: `FRESH10` (10%, cap ₹100), `SABZI50` (flat ₹50, min ₹299), `MANGO20` (20%, cap ₹80, min ₹199). A coupon below its minimum returns 400 `Coupon … needs a minimum order of ₹…`.

Server pipeline: validate input → stock check → bill (`items + ₹29 delivery [FREE ≥ ₹249] + 8% platform fee + tip − promo − subscription − wallet`) → mock UPI collect (`upiRef`) → create order `AL-100XX` → **instant mock Razorpay X payout per farmer** (grouped by farmer, one payout each) → increment farmer `totalEarnedRs` → decrement stock → wallet `SPEND` entry (if used) → **order-confirmed notification**. Response:

```json
{
  "order": { "code": "AL-10009", "status": "PAID", "totalRs": 229, "farmerPayoutRs": 185, "slotKey": "TODAY_EVE", "etaMin": 106, "subscription": "WEEKLY", "nextDeliveryAt": "2026-09-27T…", "tipRs": 20, "walletUsedRs": 128, "items": [{ "farmerName": "Dattatray Kale", "payoutRef": "payout_…", "farmerPayoutRs": 95 }], "nextStageInMin": 3, "awaitingWindow": false },
  "payouts": [{ "farmerName": "Dattatray Kale", "farmerAvatar": "🧑‍🌾", "amountRs": 185, "payoutRef": "payout_i080bvkwmf", "upiId": "dattatray.farm@upi" }],
  "discountRs": 19,
  "subDiscountRs": 9,
  "walletUsedRs": 128,
  "tipRs": 20
}
```

### POST /api/orders/[code]

Post-payment order actions (whitelisted):

```json
{ "action": "CANCEL", "reason": "Ordered by mistake" }
{ "action": "ISSUE", "reason": "One tomato was bruised" }
```

**CANCEL** — only while `PAID | PACKED` (once it's OUT_FOR_DELIVERY the rider is en route → 409). Honest money flow: the farmer was already paid instantly, so the server (1) initiates a mock Razorpay-X **payout reversal per farmer** (`rev_…` refs, farmer `totalEarnedRs` adjusted), (2) restores stock, (3) refunds **everything the buyer paid** into their AgriLink wallet instantly (`WalletTx REFUND` + `refundRs`/`refundRef`/`cancelReason`/`cancelledAt` on the order), (4) writes a wallet notification. Response: `{ order, reversalRefs: [{ farmerName, amountRs, reversalRef }], refundRs, refundRef }`.

**ISSUE** — only on DELIVERED orders; stores `issueReason` + `issueStatus: "OPEN"` and writes a support notification. 409 before delivery, 400 without a reason.

### GET /api/coupons

The live coupon book — same `PROMOS` table the client renders as chips and the server validates at pay time: `[{ code, en, hi, min, cap }]`.

### GET/POST/DELETE /api/addresses

Saved address book per buyer phone.

- `GET ?phone=` → addresses ordered default-first.
- `POST { phone, label, receiver, line, city, isDefault? }` — `label` whitelisted to `Home | Work | Other`; the **first saved address becomes default automatically**; setting `isDefault` clears the previous default.
- `DELETE ?id=&phone=` — ownership-checked; deleting the default promotes the most recent remaining address.

### GET /api/wallet?phone=

AgriLink wallet: `{ balanceRs, txs[≤25] }`. `balanceRs` = Σ signed `amountRs` over the whole ledger (`WalletTx` types: `WELCOME`, `REFERRAL`, `REFUND` are credits; `SPEND` is negative). The wallet only ever holds **buyer-side money** (refunds + rewards) — farmer payouts never pass through it.

### GET/POST /api/notifications

Server-persisted notification center (bell).

- `GET ?phone=` → `{ notifications[≤20], unread }` newest first (`kind: ORDER | WALLET | SOCIAL | SYSTEM`, icon, title, body, `readAt`).
- `POST { phone, ids? }` → marks all unread (or just `ids[]`) read; returns `{ markedRead }`. The bell auto-marks ~600 ms after opening.

Written by: order creation, cancellation refund, issue report, referral credit, subscription skip/stop/resume, and the seed (demo buyer gets a delivered + refund + social-harvest + wallet nudge).

### GET/POST /api/referrals

- `GET ?phone=` → `{ code, invites, earnedRs }`. The code is **derived deterministically from the phone** (`AGR-XXXXXX`), so it can be recomputed anywhere and works even if the inviter never visited the site again.
- `POST { code, phone }` → resolves the inviter by deriving codes for every known buyer phone, guards against **own code** and **double-claiming** (one `REFERRAL` credit per buyer), then credits ₹50 to the applicant's wallet + notification. ₹50 is platform-funded — farmer payouts untouched.

### GET/POST /api/subscription

- `GET ?phone=` → the latest order's `{ subscription, nextDeliveryAt, code }` (null when none).
- `POST { phone, action }` with `action: 'SKIP' | 'CANCEL' | 'RESUME'`: **SKIP** pushes `nextDeliveryAt` +7 days; **CANCEL** clears `subscription` + `nextDeliveryAt`; **RESUME** re-arms `WEEKLY` with `nextDeliveryAt` = now + 7 days. Each writes an order notification. Errors: 404 no orders, 409 no active subscription (for SKIP/CANCEL).

### POST /api/ai/chat

Grounded assistant. Request: `{ messages: [{ role: 'user'|'assistant', content }], }` (last 8 used).

Server behavior:
1. Injects the live catalog (id, name, price, unit, farmer, freshness) into the system prompt.
2. **Parses the budget** from the last user message (`₹X`, `under X`, `below X`, `X mein/में`, `budget of X`).
3. LLM must end with a machine line `PICKS: id1, id2, …`; the line is stripped from the reply. If missing, product names are matched from the reply text.
4. **Budget enforcement server-side**: over-budget picks are dropped; if nothing remains, the freshest/cheapest in-budget items replace them.
5. Heuristic fallback reply when the LLM is unavailable.

Response: `{ "reply": "…", "picks": [{ "id", "name", "nameHi", "emoji", "unitLabel", "priceRs", "farmerName", "farmerAvatar" }], "source": "llm"|"heuristic", "budget": 100 }`.

`picks` power the UI's one-tap **"Add all to basket"**.

### POST /api/ai/search

Natural-language search: `{ q: "something leafy for a salad" }` → LLM extracts keywords → catalog filter; substring fallback. Returns the same product shape as `/api/products`.

### GET /api/reviews?productId=

Returns `{ reviews[], count, buyerCount, avg }`. `reviews` = BUYER reviews first (newest first), then SEED community reviews. `avg` is the **blended rating**: catalog base rating weighted ×8 plus every real buyer review — so a handful of submissions moves the needle without letting one 1-star nuke a 4.9 product.

### POST /api/reviews

```json
{
  "productId": "…",          // required, must exist
  "name": "Anjali Sharma",   // 2-40 chars
  "rating": 4.5,             // 1-5, snapped to 0.5 steps
  "comment": "…",            // 3-500 chars
  "buyerPhone": "98…",       // optional — links to buyer identity
  "orderCode": "AL-10006",   // optional — marks the review "Verified buyer"
  "lang": "en"               // "en" | "hi"
}
```

Returns the created row (`source: "BUYER"`). Validation errors return `{ error }` with 400. UI entry points: "Write a review" in the product sheet and the ⭐ Rate pills on DELIVERED order items.

### POST /api/farmers/follow

```json
{ "farmerId": "…", "follow": true }   // follow:false decrements
```

→ `{ "farmerId": "…", "followers": 1285, "following": true }`

The **follower count is global** (stored on `Farmer.followers`) so social proof is real for every visitor; *who* follows is per-device (zustand persist) in the demo — production would key it to the buyer account. Floored at 0. The farmer sheet follows optimistically and rolls back + toasts if the POST fails.

---

## 3. Fee math (shared client/server)

`billFor(itemsTotal)` (`src/lib/agrilink-client.ts`): delivery ₹29 (0 above ₹249), platform 8% of items, farmer receives 100% of items. Promos subtract from the consumer total only.

## 4. Mocked integrations (explicit)

| Mock | Where | Production swap |
| --- | --- | --- |
| Consumer UPI collect | `upiRef` in orders POST | Razorpay/PhonePe checkout |
| Razorpay X farmer payout | `payout_…` refs, instant | Razorpay X Payouts API |
| Order lifecycle clock | 150 s/stage in orders GET | logistics webhooks |
| WhatsApp updates | client-side simulation of stage changes | WhatsApp Business API |
| Product reviews | deterministic demo reviews in client lib | reviews table |
| AI chat/search | z-ai LLM + heuristic fallback | same SDK, prod keys |
