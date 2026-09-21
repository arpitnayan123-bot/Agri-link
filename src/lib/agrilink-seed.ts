// AgriLink seed — 7 verified farmers (MH + PB pilot) × 22 farmer-direct products.
// Freshness is ALIVE: harvestedAt is set relative to seed time and the UI score
// decays hour by hour, so "harvested 4h ago" really reads ~96 on day one.

import { db } from '@/lib/db'
import { demoReviewsFor } from '@/lib/agrilink-client'

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000)

const FARMERS = [
  {
    name: 'Sunita Deshmukh',
    phone: '+919822100001',
    village: 'Pimpalgaon',
    district: 'Nashik',
    state: 'Maharashtra',
    avatar: '👩‍🌾',
    story:
      'I grow tomatoes and capsicum the way my mother taught me — neem spray, cow-dung compost, zero chemicals. My daughters check every crate before it leaves the farm.',
    storyHi:
      'मैं अपनी माँ के तरीके से टमाटर और शिमला मिर्च उगाती हूँ — नीम छिड़काव, गोबर खाद, शून्य केमिकल। हर क्रेट जाने से पहले मेरी बेटियाँ जाँचती हैं।',
    upiId: 'sunita.farm@upi',
    followers: 1284,
  },
  {
    name: 'Ramesh Pawar',
    phone: '+919822100002',
    village: 'Dindori',
    district: 'Nashik',
    state: 'Maharashtra',
    avatar: '👨‍🌾',
    story:
      'Twenty-two years of onions. I sort every bulb by hand — no size machines. If it cracks in transit, message me and I refund from my own pocket.',
    storyHi:
      'बाईस साल से प्याज। हर प्याज़ हाथ से छाँटता हूँ — कोई मशीन नहीं। रास्ते में टूट जाए तो मैं अपनी जेब से वापस करता हूँ।',
    upiId: 'ramesh.farm@upi',
    followers: 862,
  },
  {
    name: 'Gurpreet Singh',
    phone: '+919822100003',
    village: 'Dakha',
    district: 'Ludhiana',
    state: 'Punjab',
    avatar: '🧑‍🌾',
    story:
      'My tractor runs on biodiesel from crop waste. Potatoes, carrots, sweet corn — dug fresh, never cold-stored for weeks like the mandi lots.',
    storyHi:
      'मेरा ट्रैक्टर फसल कचरे के बायोडीज़ल पर चलता है। आलू, गाजर, स्वीट कॉर्न — ताज़ा खोदता हूँ, मंडी जैसे हफ़्तों कोल्ड-स्टोर में नहीं।',
    upiId: 'gurpreet.farm@upi',
    followers: 731,
  },
  {
    name: 'Balvir Kaur',
    phone: '+919822100004',
    village: 'Bhawanigarh',
    district: 'Sangrur',
    state: 'Punjab',
    avatar: '👩‍🌾',
    story:
      'Leafy greens are my pride — cut at dawn, packed by 8am, on your plate the same day. No sprays, only ladybird beetles for aphids.',
    storyHi:
      'हरी सब्ज़ियाँ मेरी शान हैं — भोर में कटती हैं, 8 बजे तक पैक, उसी दिन आपकी थाली में। कोई स्प्रे नहीं, माहूं से लेडीबर्ड बीटल ही काम करते हैं।',
    upiId: 'balvir.farm@upi',
    followers: 1543,
  },
  {
    name: 'Dattatray Kale',
    phone: '+919822100005',
    village: 'Dapoli',
    district: 'Ratnagiri',
    state: 'Maharashtra',
    avatar: '🧑‍🌾',
    story:
      'Alphonso mangoes from 60-year-old trees on my grandfather\'s slope. Tree-ripened, never carbide. What you taste is pure Konkan sun.',
    storyHi:
      'दादाजी के ढलान के 60 साल पुराने पेड़ों के हापुस आम। पेड़ पर ही पके, कार्बाइड नहीं। जो स्वाद है वह शुद्ध कोंकण की धूप है।',
    upiId: 'dattatray.farm@upi',
    followers: 2318,
  },
  {
    name: 'Meena Shinde',
    phone: '+919822100006',
    village: 'Junnar',
    district: 'Pune',
    state: 'Maharashtra',
    avatar: '👩‍🌾',
    story:
      'Cauliflower, brinjal, cucumber — drip-irrigated, intercropped with marigold so pests stay away without a drop of chemical.',
    storyHi:
      'फूलगोभी, बैंगन, खीरा — ड्रिप सिंचाई, गेंदा के साथ सह-फसल ताकि बिना केमिकल कीट दूर रहें।',
    upiId: 'meena.farm@upi',
    followers: 497,
  },
  {
    name: 'Harpreet Gill',
    phone: '+919822100007',
    village: 'Shahkot',
    district: 'Jalandhar',
    state: 'Punjab',
    avatar: '👨‍🌾',
    story:
      'Ginger, garlic, spring onions — I built a small wash-pack unit on the farm itself, so nothing sits in a distant warehouse.',
    storyHi:
      'अदरक, लहसुन, हरे प्याज़ — खेत पर ही छोटी वॉश-पैक यूनिट बनाई है, ताकि कुछ भी दूर के गोदाम में न रुके।',
    upiId: 'harpreet.farm@upi',
    followers: 612,
  },
]

type SeedProduct = {
  name: string
  nameHi: string
  category: 'VEGETABLES' | 'FRUITS' | 'LEAFY' | 'HERBS'
  emoji: string
  description: string
  descriptionHi: string
  unitLabel: string
  priceRs: number
  mrpRs: number
  mandiPriceRs: number
  farmerIdx: number
  harvestedHoursAgo: number
  stockKg: number
  tags: string[]
  isBestseller?: boolean
  rating: number
  accent: string
}

const PRODUCTS: SeedProduct[] = [
  { name: 'Desi Tomatoes', nameHi: 'देसी टमाटर', category: 'VEGETABLES', emoji: '🍅', description: 'Sun-ripened, thick-fleshed desi variety — curd-thick gravy in minutes.', descriptionHi: 'धूप में पकी गाढ़ी देसी किस्म — मिनटों में गाढ़ी ग्रेवी।', unitLabel: '500 g', priceRs: 32, mrpRs: 44, mandiPriceRs: 12, farmerIdx: 0, harvestedHoursAgo: 4, stockKg: 80, tags: ['No pesticides', 'Vine-ripened'], isBestseller: true, rating: 4.9, accent: 'tomato' },
  { name: 'Red Onions', nameHi: 'लाल प्याज़', category: 'VEGETABLES', emoji: '🧅', description: 'Hand-sorted Nashik reds — sharp, sweet, and patient in the pan.', descriptionHi: 'हाथ से छाँटा नासिक लाल — तीखा, मीठा, कड़ाही में भरपूर।', unitLabel: '1 kg', priceRs: 38, mrpRs: 52, mandiPriceRs: 14, farmerIdx: 1, harvestedHoursAgo: 8, stockKg: 200, tags: ['Hand-sorted', 'Cured naturally'], isBestseller: true, rating: 4.8, accent: 'amber' },
  { name: 'Potatoes', nameHi: 'आलू', category: 'VEGETABLES', emoji: '🥔', description: 'Fresh-dug Ludhiana potatoes — never weeks in cold storage.', descriptionHi: 'ताज़ा खोदा लुधियाना आलू — हफ़्तों कोल्ड-स्टोर में नहीं।', unitLabel: '1 kg', priceRs: 34, mrpRs: 45, mandiPriceRs: 12, farmerIdx: 2, harvestedHoursAgo: 12, stockKg: 250, tags: ['Fresh-dug', 'No wax'], isBestseller: true, rating: 4.8, accent: 'tan' },
  { name: 'Okra (Bhindi)', nameHi: 'भिंडी', category: 'VEGETABLES', emoji: '🌿', description: 'Tender young pods that snap, not bend — picked every morning.', descriptionHi: 'कोमल कच्ची भिंडी जो टूटती है, मुड़ती नहीं — हर सुबह तुड़ाई।', unitLabel: '500 g', priceRs: 36, mrpRs: 50, mandiPriceRs: 15, farmerIdx: 5, harvestedHoursAgo: 6, stockKg: 60, tags: ['Tender pods', 'Morning picked'], rating: 4.7, accent: 'lime' },
  { name: 'Brinjal (Baingan)', nameHi: 'बैंगन', category: 'VEGETABLES', emoji: '🍆', description: 'Glossy purple baingan with tiny seeds — bharta-approved.', descriptionHi: 'चमकदार बैंगनी बैंगन, बारीक बीज — भरता के लिए बेस्ट।', unitLabel: '500 g', priceRs: 34, mrpRs: 48, mandiPriceRs: 13, farmerIdx: 5, harvestedHoursAgo: 10, stockKg: 55, tags: ['Marigold intercrop'], rating: 4.7, accent: 'plum' },
  { name: 'Capsicum', nameHi: 'शिमला मिर्च', category: 'VEGETABLES', emoji: '🫑', description: 'Crunchy thick walls, zero chemical — farmers\'-market crunch.', descriptionHi: 'कुरकुरी मोटी दीवार, शून्य केमिकल — मंडी से भी ताज़ा क्रंच।', unitLabel: '500 g', priceRs: 40, mrpRs: 55, mandiPriceRs: 18, farmerIdx: 0, harvestedHoursAgo: 7, stockKg: 45, tags: ['No pesticides', 'Crunch-fresh'], rating: 4.8, accent: 'emerald' },
  { name: 'Cucumber', nameHi: 'खीरा', category: 'VEGETABLES', emoji: '🥒', description: 'Cool, seedless-ish salad cucumbers with real cucumber smell.', descriptionHi: 'ठंडे सलाद खीरे, असली खीरे वाली महक के साथ।', unitLabel: '500 g', priceRs: 26, mrpRs: 36, mandiPriceRs: 10, farmerIdx: 5, harvestedHoursAgo: 5, stockKg: 70, tags: ['Drip-irrigated'], rating: 4.6, accent: 'teal' },
  { name: 'Cauliflower', nameHi: 'फूलगोभी', category: 'VEGETABLES', emoji: '🥦', description: 'Snow-tight curds wrapped in their own leaves — no black spots.', descriptionHi: 'अपने पत्तों में लिपटी सफ़ेद गोभी — कोई काले धब्बे नहीं।', unitLabel: '1 pc (~500 g)', priceRs: 35, mrpRs: 48, mandiPriceRs: 14, farmerIdx: 5, harvestedHoursAgo: 14, stockKg: 50, tags: ['Field-wrapped'], rating: 4.7, accent: 'sky' },
  { name: 'Carrots', nameHi: 'गाजर', category: 'VEGETABLES', emoji: '🥕', description: 'Sweet, crunchy Punjab carrots — gajar halwa season\'s best.', descriptionHi: 'मीठी कुरकुरी पंजाब गाजर — गाजर का हलवा वाली सीज़न बेस्ट।', unitLabel: '500 g', priceRs: 30, mrpRs: 42, mandiPriceRs: 12, farmerIdx: 2, harvestedHoursAgo: 9, stockKg: 65, tags: ['No wax'], rating: 4.8, accent: 'orange' },
  { name: 'Green Chilli', nameHi: 'हरी मिर्च', category: 'VEGETABLES', emoji: '🌶️', description: 'Fiery little Guntur-style chillies — two is enough for dal.', descriptionHi: 'तीखी छोटी मिर्च — दाल में दो ही काफ़ी।', unitLabel: '250 g', priceRs: 22, mrpRs: 30, mandiPriceRs: 9, farmerIdx: 5, harvestedHoursAgo: 6, stockKg: 40, tags: ['Naturally spicy'], rating: 4.7, accent: 'chilli' },
  { name: 'Ginger', nameHi: 'अदरक', category: 'VEGETABLES', emoji: '🫚', description: 'Juicy, thin-skinned ginger that grates without threads.', descriptionHi: 'रसदार पतली छिलका वाला अदरक, बिना रेशों के पिसता है।', unitLabel: '250 g', priceRs: 28, mrpRs: 38, mandiPriceRs: 12, farmerIdx: 6, harvestedHoursAgo: 16, stockKg: 45, tags: ['Farm-washed'], rating: 4.7, accent: 'tan' },
  { name: 'Garlic', nameHi: 'लहसुन', category: 'VEGETABLES', emoji: '🧄', description: 'Firm bulbs with big cloves — peel-friendly and pungent.', descriptionHi: 'दमदार बड़े लौंग वाली कड़ी गांठें — छीलने में आसान।', unitLabel: '250 g', priceRs: 36, mrpRs: 48, mandiPriceRs: 16, farmerIdx: 6, harvestedHoursAgo: 18, stockKg: 40, tags: ['Sun-cured'], rating: 4.8, accent: 'stone' },
  { name: 'Sweet Corn', nameHi: 'स्वीट कॉर्न', category: 'VEGETABLES', emoji: '🌽', description: 'Milky-sweet cobs picked at dawn — steam for 8 minutes.', descriptionHi: 'भोर में तुड़े दूध-मीठे भुट्टे — 8 मिनट स्टीम करें।', unitLabel: '2 pcs', priceRs: 40, mrpRs: 54, mandiPriceRs: 18, farmerIdx: 2, harvestedHoursAgo: 8, stockKg: 50, tags: ['Same-day cobs'], rating: 4.8, accent: 'mango' },
  { name: 'Spinach (Palak)', nameHi: 'पालक', category: 'LEAFY', emoji: '🥬', description: 'Cut at dawn, soft stems, iron-rich — palak paneer tonight?', descriptionHi: 'भोर में कटा, कोमल डंठल, आयरन से भरपूर — आज रात पालक पनीर?', unitLabel: '500 g', priceRs: 24, mrpRs: 34, mandiPriceRs: 8, farmerIdx: 3, harvestedHoursAgo: 3, stockKg: 55, tags: ['No sprays', 'Dawn-cut'], isBestseller: true, rating: 4.9, accent: 'leafy' },
  { name: 'Fenugreek (Methi)', nameHi: 'मेथी', category: 'LEAFY', emoji: '🌿', description: ' fragrant methi thepla-grade leaves, tender not bitter.', descriptionHi: 'सुगंधित मेथी — थेपला-ग्रेड पत्ते, कोमल न कि कड़वे।', unitLabel: '250 g', priceRs: 18, mrpRs: 26, mandiPriceRs: 7, farmerIdx: 3, harvestedHoursAgo: 5, stockKg: 35, tags: ['Ladybird-protected'], rating: 4.7, accent: 'leafy' },
  { name: 'Spring Onions', nameHi: 'हरे प्याज़', category: 'LEAFY', emoji: '🌱', description: 'Crisp whites + deep-green tops — stir-fry ready.', descriptionHi: 'कुरकुरा सफ़ेद + गहरा हरा — स्टर-फ्राई तैयार।', unitLabel: '250 g', priceRs: 20, mrpRs: 28, mandiPriceRs: 8, farmerIdx: 6, harvestedHoursAgo: 6, stockKg: 30, tags: ['Farm-pack'], rating: 4.6, accent: 'emerald' },
  { name: 'Coriander (Dhaniya)', nameHi: 'धनिया', category: 'HERBS', emoji: '🌿', description: 'Aromatic bunches that perfume the whole bag — no yellow leaves.', descriptionHi: 'खुशबूदार गुच्छे जो पूरे बैग में घुल जाएँ — कोई पीला पत्ता नहीं।', unitLabel: '250 g', priceRs: 20, mrpRs: 30, mandiPriceRs: 10, farmerIdx: 3, harvestedHoursAgo: 4, stockKg: 35, tags: ['Dawn-cut', 'Fragrant'], isBestseller: true, rating: 4.9, accent: 'leafy' },
  { name: 'Mint (Pudina)', nameHi: 'पुदीना', category: 'HERBS', emoji: '🍃', description: 'Chewing-gum cool chutney mint — thick leaves, thin stems.', descriptionHi: 'चटनी के लिए ठंडा पुदीना — मोटे पत्ते, पतले तने।', unitLabel: '250 g', priceRs: 18, mrpRs: 26, mandiPriceRs: 8, farmerIdx: 3, harvestedHoursAgo: 5, stockKg: 30, tags: ['No sprays'], rating: 4.8, accent: 'mint' },
  { name: 'Alphonso Mango', nameHi: 'हापुस आम', category: 'FRUITS', emoji: '🥭', description: 'Tree-ripened Konkan hapus — zero carbide, saffron flesh.', descriptionHi: 'पेड़ पर पका कोंकण हापुस — शून्य कार्बाइड, केसरिया गूदा।', unitLabel: '1 kg (3-4 pcs)', priceRs: 220, mrpRs: 300, mandiPriceRs: 90, farmerIdx: 4, harvestedHoursAgo: 10, stockKg: 60, tags: ['Tree-ripened', 'No carbide'], isBestseller: true, rating: 5.0, accent: 'mango' },
  { name: 'Bananas', nameHi: 'केले', category: 'FRUITS', emoji: '🍌', description: 'Small-farm elaichi bananas — honey-sweet, thin skin.', descriptionHi: 'छोटे खेत के इलायची केले — शहद-मीठे, पतला छिलका।', unitLabel: '6 pcs', priceRs: 42, mrpRs: 56, mandiPriceRs: 18, farmerIdx: 4, harvestedHoursAgo: 7, stockKg: 80, tags: ['Naturally ripened'], rating: 4.7, accent: 'mango' },
  { name: 'Guava', nameHi: 'अमरूद', category: 'FRUITS', emoji: '🍈', description: 'White-flesh, guava-cheese aroma — sprinkle chaat masala.', descriptionHi: 'सफ़ेद गूदा, अमरूद-मिठाई महक — चाट मसाला छिड़कें।', unitLabel: '500 g', priceRs: 48, mrpRs: 64, mandiPriceRs: 22, farmerIdx: 4, harvestedHoursAgo: 12, stockKg: 40, tags: ['Hand-picked'], rating: 4.6, accent: 'lime' },
  { name: 'Pomegranate', nameHi: 'अनार', category: 'FRUITS', emoji: '🍎', description: 'Deep-ruby arils, almost seedless — gym-snack approved.', descriptionHi: 'गहरे रुबी दाने, लगभग बिना बीज — जिम-स्नैक अप्रूव्ड।', unitLabel: '500 g', priceRs: 95, mrpRs: 130, mandiPriceRs: 45, farmerIdx: 4, harvestedHoursAgo: 16, stockKg: 35, tags: ['Sweet grade A'], rating: 4.8, accent: 'berry' },
]

export async function isSeeded(): Promise<boolean> {
  const count = await db.product.count()
  return count > 0
}

export async function ensureSeeded(): Promise<void> {
  if (await isSeeded()) return
  await seed()
}

export async function seed(): Promise<void> {
  await db.orderItem.deleteMany()
  await db.order.deleteMany()
  await db.review.deleteMany()
  await db.product.deleteMany()
  await db.farmer.deleteMany()

  const farmers = await Promise.all(
    FARMERS.map((f) =>
      db.farmer.create({
        data: {
          name: f.name,
          phone: f.phone,
          village: f.village,
          district: f.district,
          state: f.state,
          avatar: f.avatar,
          story: f.story,
          storyHi: f.storyHi,
          upiId: f.upiId,
          kycVerified: true,
          rating: 4.9,
          followers: f.followers,
        },
      })
    )
  )

  for (const p of PRODUCTS) {
    const created = await db.product.create({
      data: {
        name: p.name,
        nameHi: p.nameHi,
        category: p.category,
        emoji: p.emoji,
        description: p.description,
        descriptionHi: p.descriptionHi,
        unitLabel: p.unitLabel,
        priceRs: p.priceRs,
        mrpRs: p.mrpRs,
        mandiPriceRs: p.mandiPriceRs,
        farmerId: farmers[p.farmerIdx].id,
        chemicalFree: true,
        harvestedAt: hoursAgo(p.harvestedHoursAgo),
        stockKg: p.stockKg,
        tags: JSON.stringify(p.tags),
        isBestseller: p.isBestseller ?? false,
        rating: p.rating,
        accent: p.accent,
      },
    })
    // Community reviews (SEED source) — deterministic, mixed EN/HI, dated in the past.
    for (const r of demoReviewsFor(created.id, p.rating)) {
      await db.review.create({
        data: {
          productId: created.id,
          name: r.name,
          rating: r.rating,
          comment: r.comment,
          lang: /[\u0900-\u097F]/.test(r.comment) ? 'hi' : 'en',
          source: 'SEED',
          createdAt: new Date(Date.now() - r.daysAgo * 86_400_000),
        },
      })
    }
  }

  // Demo orders so My Orders + stats feel alive on first open.
  const products = await db.product.findMany()

  const demoOrders: {
    buyerName: string
    phone: string
    city: string
    address: string
    status: string
    slotKey?: string
    subscription?: 'WEEKLY'
    cancelReason?: string
    items: { name: string; qty: number }[]
  }[] = [
    { buyerName: 'Anjali Sharma', phone: '+919812345678', city: 'Pune', address: 'Flat 402, Sunrise Residency, Baner', status: 'DELIVERED', items: [{ name: 'Desi Tomatoes', qty: 2 }, { name: 'Spinach (Palak)', qty: 1 }, { name: 'Coriander (Dhaniya)', qty: 1 }] },
    { buyerName: 'Rohit Verma', phone: '+919812345679', city: 'Mumbai', address: '12, Sea Breeze Apartments, Andheri West', status: 'DELIVERED', items: [{ name: 'Alphonso Mango', qty: 1 }, { name: 'Bananas', qty: 1 }] },
    { buyerName: 'Priya Nair', phone: '+919812345680', city: 'Pune', address: 'A-9, Kalyani Nagar', status: 'DELIVERED', items: [{ name: 'Red Onions', qty: 2 }, { name: 'Potatoes', qty: 2 }, { name: 'Okra (Bhindi)', qty: 1 }, { name: 'Green Chilli', qty: 1 }] },
    { buyerName: 'Karan Malhotra', phone: '+919812345681', city: 'Delhi', address: 'B-15, Greater Kailash II', status: 'OUT_FOR_DELIVERY', items: [{ name: 'Alphonso Mango', qty: 2 }, { name: 'Pomegranate', qty: 1 }] },
    { buyerName: 'Sneha Joshi', phone: '+919812345682', city: 'Pune', address: '7, Erandwane, Karve Road', status: 'PACKED', slotKey: 'TMR_MORN', subscription: 'WEEKLY', items: [{ name: 'Spinach (Palak)', qty: 2 }, { name: 'Mint (Pudina)', qty: 1 }, { name: 'Cucumber', qty: 2 }] },
    // One cancelled order — so the cancel flow + refund proof are discoverable.
    { buyerName: 'Anjali Sharma', phone: '+919812345678', city: 'Pune', address: 'Flat 402, Sunrise Residency, Baner', status: 'CANCELLED', cancelReason: 'Ordered by mistake', items: [{ name: 'Green Chilli', qty: 1 }] },
  ]

  let code = 10001
  for (const o of demoOrders) {
    const prods = o.items
      .map((it) => ({ p: products.find((x) => x.name === it.name), qty: it.qty }))
      .filter((x): x is { p: (typeof products)[number]; qty: number } => !!x.p)
    if (!prods.length) continue
    const itemsTotal = prods.reduce((s, x) => s + x.p.priceRs * x.qty, 0)
    const deliveryFeeRs = itemsTotal >= 249 ? 0 : 29
    const platformFeeRs = Math.round(itemsTotal * 0.08)
    const isCancelled = o.status === 'CANCELLED'
    const order = await db.order.create({
      data: {
        code: `AL-${code++}`,
        buyerName: o.buyerName,
        buyerPhone: o.phone,
        buyerCity: o.city,
        address: o.address,
        itemsTotalRs: itemsTotal,
        deliveryFeeRs,
        platformFeeRs,
        totalRs: itemsTotal + deliveryFeeRs + platformFeeRs,
        farmerPayoutRs: itemsTotal,
        upiRef: `UPI${Date.now().toString(36).toUpperCase()}${code}`,
        status: o.status,
        slotKey: o.slotKey ?? 'EXPRESS',
        etaMin: 90 + Math.floor(Math.random() * 60),
        subscription: o.subscription ?? null,
        nextDeliveryAt: o.subscription ? new Date(Date.now() + 7 * 86_400_000) : null,
        // Cancelled demo order carries its honest money trail.
        cancelReason: isCancelled ? (o.cancelReason ?? 'Changed my mind') : null,
        cancelledAt: isCancelled ? hoursAgo(20) : null,
        refundRs: isCancelled ? itemsTotal + deliveryFeeRs + platformFeeRs : 0,
        refundRef: isCancelled ? `refnd_seed${code}` : null,
      },
    })
    // per-farmer payout grouping (mirrors the orders API)
    const byFarmer = new Map<string, number>()
    for (const x of prods) {
      byFarmer.set(x.p.farmerId, (byFarmer.get(x.p.farmerId) ?? 0) + x.p.priceRs * x.qty)
    }
    const payoutByFarmer = new Map<string, string>()
    for (const [farmerId] of byFarmer) {
      payoutByFarmer.set(farmerId, `payout_${Math.random().toString(36).slice(2, 16)}`)
    }
    for (const x of prods) {
      await db.orderItem.create({
        data: {
          orderId: order.id,
          productId: x.p.id,
          farmerId: x.p.farmerId,
          name: x.p.name,
          emoji: x.p.emoji,
          unitLabel: x.p.unitLabel,
          qty: x.qty,
          unitPriceRs: x.p.priceRs,
          farmerPayoutRs: x.p.priceRs * x.qty,
          payoutRef: payoutByFarmer.get(x.p.farmerId)!,
        },
      })
      // A cancelled order's payout was reversed — farmers' lifetime earnings
      // stay honest (increment then decrement for the cancelled demo order).
      await db.farmer.update({
        where: { id: x.p.farmerId },
        data: { totalEarnedRs: { increment: isCancelled ? 0 : x.p.priceRs * x.qty } },
      })
    }
  }

  // ─── Demo buyer's money + account surfaces (Anjali, +919812345678) ────────
  const demoPhone = '+919812345678'
  const cancelledOrder = demoOrders.find((o) => o.status === 'CANCELLED')
  const refundAmount = cancelledOrder
    ? (() => {
        const items = cancelledOrder.items.reduce((s, it) => s + (products.find((x) => x.name === it.name)?.priceRs ?? 0) * it.qty, 0)
        const fee = items >= 249 ? 0 : 29
        return items + fee + Math.round(items * 0.08)
      })()
    : 0

  await db.walletTx.createMany({
    data: [
      { phone: demoPhone, type: 'WELCOME', amountRs: 25, note: 'Welcome to AgriLink 🌱', createdAt: hoursAgo(72) },
      { phone: demoPhone, type: 'REFERRAL', amountRs: 50, note: 'Referral bonus · Rohit joined', ref: 'AGR-DEMO01', createdAt: hoursAgo(48) },
      ...(refundAmount > 0
        ? [{ phone: demoPhone, type: 'REFUND', amountRs: refundAmount, note: 'Refund · cancelled order', ref: 'refnd_seed10006', createdAt: hoursAgo(20) }]
        : []),
    ],
  })

  await db.address.createMany({
    data: [
      { phone: demoPhone, label: 'Home', receiver: 'Anjali Sharma', line: 'Flat 402, Sunrise Residency, Baner', city: 'Pune', isDefault: true },
      { phone: demoPhone, label: 'Work', receiver: 'Anjali Sharma', line: '3rd floor, Cerebra Integrated Tech, Hinjawadi Phase 2', city: 'Pune', isDefault: false },
    ],
  })

  await db.notification.createMany({
    data: [
      {
        phone: demoPhone,
        kind: 'ORDER' as const,
        icon: '✅',
        title: 'Order AL-10001 delivered',
        body: 'Hope the tomatoes were as sweet as promised 🍅 Rate your harvest in My Orders.',
        readAt: null,
        createdAt: hoursAgo(26),
      },
      {
        phone: demoPhone,
        kind: 'WALLET' as const,
        icon: '↩️',
        title: `₹${Math.round(refundAmount)} refunded to your wallet`,
        body: 'Order AL-10006 was cancelled (Ordered by mistake). Every farmer payout was reversed and your refund landed instantly.',
        readAt: null,
        createdAt: hoursAgo(20),
      },
      {
        phone: demoPhone,
        kind: 'SOCIAL' as const,
        icon: '🌱',
        title: 'Sunita harvested fresh tomatoes',
        body: 'A farmer you follow just listed vine-ripened desi tomatoes — picked 4 hours ago. They are live in the market now.',
        readAt: null,
        createdAt: hoursAgo(3),
      },
      {
        phone: demoPhone,
        kind: 'SYSTEM' as const,
        icon: '🎁',
        title: '₹75 waiting in your wallet',
        body: 'Welcome credit + referral bonus are ready to spend on your next basket. Apply them at checkout.',
        readAt: hoursAgo(40),
        createdAt: hoursAgo(50),
      },
    ],
  })
}
