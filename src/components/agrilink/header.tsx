'use client'

// AgriLink header — clay-glass bar: logo, AI smart search, lang toggle,
// orders, cart. Sticky with premium depth.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Image from 'next/image'
import { useTheme } from 'next-themes'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { apiGet, apiPost, type Product } from '@/lib/agrilink-client'
import { makeT } from '@/lib/agrilink-i18n'
import { useAgriLink } from '@/store/agrilink'
import { NotificationsBell } from '@/components/agrilink/notifications-bell'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, Moon, Package, Search, ShoppingBag, Sparkles, Sun } from 'lucide-react'

export function AgriLinkHeader() {
  const { lang, toggleLang, setView, view, setCartOpen, cart, openProduct, setAiOpen } = useAgriLink()
  const t = makeT(lang)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Product[]>([])
  const [searching, setSearching] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  const { data: products } = useQuery({ queryKey: ['products', 'all'], queryFn: () => apiGet<Product[]>('/api/products') })
  const count = cart.reduce((s, l) => s + l.qty, 0)

  // AI smart search (debounced, natural language)
  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      setHits([])
      setSearching(false)
      return
    }
    setSearching(true)
    const id = setTimeout(async () => {
      try {
        const res = await apiPost<Product[]>('/api/ai/search', { q: term })
        setHits(res)
      } catch {
        const local = (products ?? []).filter((p) => `${p.name} ${p.nameHi}`.toLowerCase().includes(term.toLowerCase()))
        setHits(local.slice(0, 8))
      } finally {
        setSearching(false)
      }
    }, 450)
    return () => clearTimeout(id)
  }, [q, products])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setHits([])
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <header className="sticky top-0 z-40 border-b border-white/60 bg-[var(--al-header)] shadow-[0_4px_20px_-8px_rgba(120,92,40,0.25)] dark:border-white/10 dark:shadow-[0_4px_20px_-8px_rgba(0,0,0,0.6)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4">
        {/* Brand */}
        <button className="flex shrink-0 items-center gap-2 focus:outline-none" onClick={() => setView('market')} aria-label="AgriLink home">
          <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-[var(--al-card)] shadow-[0_4px_12px_-2px_rgba(120,92,40,0.3),inset_0_1px_2px_rgba(255,255,255,0.9)] sm:h-11 sm:w-11">
            <Image src="/agrilink-logo.png" alt="AgriLink logo" width={44} height={44} className="al-sway h-8 w-8 object-contain sm:h-9 sm:w-9" priority />
          </span>
          <span className="hidden flex-col leading-none sm:flex">
            <span className="font-display text-xl font-extrabold tracking-tight text-[var(--al-ink)]">
              Agri<span className="text-[var(--al-green)]">Link</span>
            </span>
            <span className="text-[10px] font-semibold text-[var(--al-mango-ink)]">{t('brandTag')}</span>
          </span>
        </button>

        {/* AI smart search */}
        <div ref={boxRef} className="relative min-w-0 flex-1">
          <div className="neu-inset flex items-center gap-2 rounded-2xl px-3 py-2">
            {searching ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--al-green)]" /> : <Search className="h-4 w-4 shrink-0 text-[var(--al-sand)]" />}
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('searchPh')}
              className="min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-[var(--al-sand)]"
              aria-label={t('searchPh')}
            />
            <Sparkles className="h-4 w-4 shrink-0 text-[var(--al-amber)]" aria-hidden />
          </div>
          <AnimatePresence>
            {hits.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.98 }}
                className="clay al-scroll absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto p-2"
                role="listbox"
              >
                <p className="px-2 pb-1 pt-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--al-sand)]">✨ AI search</p>
                {hits.map((p) => (
                  <button
                    key={p.id}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-[var(--al-panel)]"
                    onClick={() => {
                      setHits([])
                      setQ('')
                      openProduct(p.id)
                    }}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--al-panel-3)] text-lg">{p.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{lang === 'hi' ? p.nameHi : p.name}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {p.unitLabel} · {p.farmer.name}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-extrabold text-[var(--al-green)]">₹{p.priceRs}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Actions */}
        <nav className="flex shrink-0 items-center gap-1.5" aria-label="Main">
          <Button
            size="sm"
            variant="ghost"
            className="hidden h-10 gap-1.5 rounded-full px-3 text-xs font-extrabold text-[var(--al-ink)] hover:bg-[var(--al-chip)] md:flex"
            onClick={() => setAiOpen(true)}
          >
            <Sparkles className="h-4 w-4 text-[var(--al-amber)]" /> {t('aiAssistant')}
          </Button>
          <Button
            size="sm"
            variant={view === 'orders' ? 'default' : 'ghost'}
            className={`h-10 gap-1.5 rounded-full px-3 text-xs font-extrabold ${view === 'orders' ? '' : 'text-[var(--al-ink)] hover:bg-[var(--al-chip)]'}`}
            onClick={() => setView(view === 'orders' ? 'market' : 'orders')}
          >
            <Package className="h-4 w-4" /> <span className="hidden sm:inline">{t('myOrders')}</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-10 rounded-full px-3 text-xs font-extrabold text-[var(--al-ink)] hover:bg-[var(--al-chip)]"
            onClick={toggleLang}
            aria-label="Toggle language"
          >
            {lang === 'en' ? 'हिं' : 'EN'}
          </Button>
          <ThemeToggle />
          <NotificationsBell />
          <button
            className="al-add flex h-10 items-center gap-2 px-3.5 text-xs font-extrabold sm:px-4"
            onClick={() => setCartOpen(true)}
            aria-label={`${t('cart')} (${count})`}
          >
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden sm:inline">{t('cart')}</span>
            {count > 0 && (
              <motion.span
                key={count}
                initial={{ scale: 0.4 }}
                animate={{ scale: 1 }}
                className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--al-card)] px-1 text-[11px] font-black text-[var(--al-green)] shadow"
              >
                {count}
              </motion.span>
            )}
          </button>
        </nav>
      </div>
    </header>
  )
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  // hydration-safe "mounted" without setState-in-effect (lint rule)
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false)
  const dark = resolvedTheme === 'dark'
  return (
    <Button
      size="sm"
      variant="ghost"
      className="neu h-10 w-10 rounded-full border-0 p-0 text-[var(--al-brown-2)] shadow-none"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={mounted && dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={mounted && dark ? 'Light mode' : 'Dark mode'}
    >
      <span className="relative flex h-4 w-4 items-center justify-center">
        <Sun className={`h-4 w-4 transition-all duration-300 ${mounted && dark ? 'scale-0 -rotate-90 opacity-0' : 'scale-100 rotate-0 opacity-100'}`} />
        <Moon className={`absolute h-4 w-4 transition-all duration-300 ${mounted && dark ? 'scale-100 rotate-0 opacity-100' : 'scale-0 rotate-90 opacity-0'}`} />
      </span>
    </Button>
  )
}

const subscribeNoop = () => () => {}
