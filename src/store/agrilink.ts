// AgriLink client store — cart, language, view state. Persisted locally.

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type CartLine = { productId: string; qty: number }

type Buyer = { name: string; phone: string; city: string; address: string }

type AgriLinkState = {
  lang: 'en' | 'hi'
  view: 'market' | 'orders'
  cart: CartLine[]
  productSheetId: string | null
  farmerSheetId: string | null
  cartOpen: boolean
  aiOpen: boolean
  buyer: Buyer
  lastOrderId: string | null
  followedFarmerIds: string[]
  slotKey: string
  promoCode: string | null
  subscribed: boolean
  setLang: (l: 'en' | 'hi') => void
  toggleLang: () => void
  setView: (v: 'market' | 'orders') => void
  add: (productId: string) => void
  decrement: (productId: string) => void
  removeLine: (productId: string) => void
  clearCart: () => void
  pruneCart: (validIds: string[]) => void
  qtyOf: (productId: string) => number
  openProduct: (id: string | null) => void
  openFarmer: (id: string | null) => void
  setCartOpen: (open: boolean) => void
  setAiOpen: (open: boolean) => void
  setBuyer: (b: Partial<Buyer>) => void
  setLastOrderId: (id: string | null) => void
  toggleFollow: (farmerId: string) => boolean
  isFollowing: (farmerId: string) => boolean
  setSlotKey: (k: string) => void
  setPromoCode: (c: string | null) => void
  setSubscribed: (v: boolean) => void
}

export const useAgriLink = create<AgriLinkState>()(
  persist(
    (set, get) => ({
      lang: 'en',
      view: 'market',
      cart: [],
      productSheetId: null,
      farmerSheetId: null,
      cartOpen: false,
      aiOpen: false,
      buyer: { name: '', phone: '', city: '', address: '' },
      lastOrderId: null,
      followedFarmerIds: [],
      slotKey: 'EXPRESS',
      promoCode: null,
      subscribed: false,
      setLang: (lang) => set({ lang }),
      toggleLang: () => set((s) => ({ lang: s.lang === 'en' ? 'hi' : 'en' })),
      setView: (view) => set({ view }),
      add: (productId) =>
        set((s) => {
          const line = s.cart.find((l) => l.productId === productId)
          if (line) return { cart: s.cart.map((l) => (l.productId === productId ? { ...l, qty: l.qty + 1 } : l)) }
          return { cart: [...s.cart, { productId, qty: 1 }] }
        }),
      decrement: (productId) =>
        set((s) => {
          const line = s.cart.find((l) => l.productId === productId)
          if (!line) return {}
          if (line.qty <= 1) return { cart: s.cart.filter((l) => l.productId !== productId) }
          return { cart: s.cart.map((l) => (l.productId === productId ? { ...l, qty: l.qty - 1 } : l)) }
        }),
      removeLine: (productId) => set((s) => ({ cart: s.cart.filter((l) => l.productId !== productId) })),
      clearCart: () => set({ cart: [] }),
      // Drop lines whose product vanished (reseed, sold-out delisting) so the
      // badge can never claim items the basket can't show.
      pruneCart: (validIds) =>
        set((s) => {
          const valid = new Set(validIds)
          const next = s.cart.filter((l) => valid.has(l.productId))
          return next.length === s.cart.length ? {} : { cart: next }
        }),
      qtyOf: (productId) => get().cart.find((l) => l.productId === productId)?.qty ?? 0,
      openProduct: (productSheetId) => set({ productSheetId }),
      openFarmer: (farmerSheetId) => set({ farmerSheetId }),
      setCartOpen: (cartOpen) => set({ cartOpen }),
      setAiOpen: (aiOpen) => set({ aiOpen }),
      setBuyer: (b) => set((s) => ({ buyer: { ...s.buyer, ...b } })),
      setLastOrderId: (lastOrderId) => set({ lastOrderId }),
      toggleFollow: (farmerId) => {
        const has = get().followedFarmerIds.includes(farmerId)
        set((s) => ({
          followedFarmerIds: has ? s.followedFarmerIds.filter((id) => id !== farmerId) : [...s.followedFarmerIds, farmerId],
        }))
        return !has
      },
      isFollowing: (farmerId) => get().followedFarmerIds.includes(farmerId),
      setSlotKey: (slotKey) => set({ slotKey }),
      setPromoCode: (promoCode) => set({ promoCode }),
      setSubscribed: (subscribed) => set({ subscribed }),
    }),
    {
      name: 'agrilink-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ lang: s.lang, cart: s.cart, buyer: s.buyer, lastOrderId: s.lastOrderId, followedFarmerIds: s.followedFarmerIds, slotKey: s.slotKey, subscribed: s.subscribed }),
    }
  )
)
