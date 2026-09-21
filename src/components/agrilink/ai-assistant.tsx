'use client'

// AgriLink AI assistant — floating clay bubble + chat panel.
// Grounded in the live catalog via /api/ai/chat; quick prompts included.
// v2: structured product picks per reply → per-item ADD + one-tap "Add all".

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, X, Zap } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { apiPost, rs } from '@/lib/agrilink-client'
import { makeT } from '@/lib/agrilink-i18n'
import { useAgriLink } from '@/store/agrilink'

type Pick = {
  id: string
  name: string
  nameHi: string
  emoji: string
  unitLabel: string
  priceRs: number
  farmerName: string
  farmerAvatar: string
}
type Msg = { role: 'user' | 'assistant'; content: string; picks?: Pick[] }

export function AiAssistant() {
  const { lang, aiOpen, setAiOpen, cart, add } = useAgriLink()
  const t = makeT(lang)
  const { toast } = useToast()
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (aiOpen && messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          content:
            lang === 'hi'
              ? 'नमस्ते! मैं AgriLink AI हूँ 🌿 रेसिपी, टोकरी बनवाना, या ताज़गी की सलाह — बस पूछिए!'
              : "Namaste! I'm AgriLink AI 🌿 Ask me for recipes, basket ideas, or today's freshest picks!",
        },
      ])
    }
  }, [aiOpen, lang, messages.length])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  const addAll = (picks: Pick[]) => {
    picks.forEach((p) => add(p.id))
    const total = picks.reduce((s, p) => s + p.priceRs, 0)
    toast({
      title: lang === 'hi' ? '🧺 टोकरी अपडेट हो गई!' : '🧺 Basket updated!',
      description: (lang === 'hi' ? `${picks.length} उपज डाली — किसानों को ${rs(total)} तुरंत मिलेंगे!` : `${picks.length} items added — farmers get ${rs(total)} instantly!`),
    })
  }

  const send = async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || busy) return
    setInput('')
    const next: Msg[] = [...messages, { role: 'user', content }]
    setMessages(next)
    setBusy(true)
    try {
      const res = await apiPost<{ reply: string; picks?: Pick[] }>('/api/ai/chat', { messages: next.slice(-8) })
      setMessages([...next, { role: 'assistant', content: res.reply, picks: res.picks ?? [] }])
    } catch {
      setMessages([...next, { role: 'assistant', content: lang === 'hi' ? 'क्षमा करें, नेटवर्क में दिक्कत है — फिर पूछें?' : 'Sorry, network hiccup — try again?' }])
    } finally {
      setBusy(false)
    }
  }

  const quicks = [t('aiQuick1'), t('aiQuick2'), t('aiQuick3')]
  const cartCount = cart.reduce((s, l) => s + l.qty, 0)

  return (
    <>
      {/* floating bubble */}
      <AnimatePresence>
        {!aiOpen && (
          <motion.button
            initial={{ scale: 0, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0, y: 20 }}
            className="clay-mango fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-xl sm:bottom-6 sm:right-6"
            onClick={() => setAiOpen(true)}
            aria-label={t('aiAssistant')}
          >
            <span className="al-float text-2xl" aria-hidden>
              ✨
            </span>
            <span className="al-pulse-dot absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#17a24f]" />
              <span className="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-white bg-[#17a24f]" />
            </span>
            {cartCount > 0 && (
              <span className="absolute -left-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#17a24f] px-1 text-[10px] font-black text-white shadow">
                {cartCount}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* panel */}
      <AnimatePresence>
        {aiOpen && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            className="clay fixed bottom-20 right-3 z-50 flex h-[30rem] w-[calc(100vw-1.5rem)] max-w-sm flex-col overflow-hidden sm:bottom-6 sm:right-6"
            role="dialog"
            aria-label={t('aiTitle')}
          >
            {/* header */}
            <div className="flex items-center gap-2.5 border-b border-[var(--al-line)] bg-gradient-to-r from-[var(--al-chip)] to-[#FFF3CE] px-4 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--al-glass-strong)] text-lg shadow-sm">✨</span>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="text-sm font-black text-[var(--al-ink)]">{t('aiTitle')}</p>
                <p className="truncate text-[10px] font-semibold text-[var(--al-olive-2)]">{t('aiSub')}</p>
              </div>
              <button className="rounded-full p-1.5 text-[var(--al-brown)] transition hover:bg-[var(--al-glass-max)]" onClick={() => setAiOpen(false)} aria-label="Close AI">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* messages */}
            <div ref={scrollRef} className="al-scroll flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`max-w-[92%] rounded-2xl px-3 py-2 text-[13px] font-medium leading-relaxed ${
                    m.role === 'user' ? 'al-add ml-auto rounded-br-md' : 'clay rounded-bl-md text-foreground'
                  }`}
                >
                  {m.content}
                  {m.role === 'assistant' && m.picks && m.picks.length > 0 && (
                    <div className="mt-2.5 border-t border-dashed border-[var(--al-line-2)] pt-2">
                      <p className="mb-1.5 text-[9px] font-black uppercase tracking-wider text-[var(--al-sand)]">✨ {t('aiPicksTitle')}</p>
                      <div className="space-y-1.5">
                        {m.picks.map((p) => {
                          const inCart = cart.some((l) => l.productId === p.id)
                          return (
                            <div key={p.id} className="flex items-center gap-2 rounded-xl bg-[var(--al-glass)] p-1.5">
                              <span className="text-lg">{p.emoji}</span>
                              <span className="min-w-0 flex-1 leading-tight">
                                <span className="block truncate text-[11px] font-extrabold text-[var(--al-ink)]">{lang === 'hi' ? p.nameHi : p.name}</span>
                                <span className="block truncate text-[9px] font-semibold text-[var(--al-brown)]">
                                  {p.unitLabel} · {p.farmerAvatar} {p.farmerName.split(' ')[0]}
                                </span>
                              </span>
                              <span className="shrink-0 text-[11px] font-black text-[var(--al-green)]">₹{p.priceRs}</span>
                              <button
                                className={`flex h-6 shrink-0 items-center gap-0.5 rounded-lg px-1.5 text-[10px] font-black transition active:scale-90 ${
                                  inCart ? 'bg-[var(--al-chip-2)] text-[var(--al-ink-soft)]' : 'al-add text-white'
                                }`}
                                onClick={() => add(p.id)}
                                aria-label={`${t('addToCart')} ${p.name}`}
                              >
                                {inCart ? '✓' : <Plus className="h-3 w-3" />}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                      <button
                        className="al-add mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl text-[11px] font-black transition active:scale-[0.97]"
                        onClick={() => addAll(m.picks!)}
                      >
                        <Zap className="h-3.5 w-3.5" />
                        {t('aiAddAll')} · {rs(m.picks.reduce((s, p) => s + p.priceRs, 0))}
                      </button>
                    </div>
                  )}
                </motion.div>
              ))}
              {busy && (
                <div className="clay flex w-fit items-center gap-1.5 rounded-2xl rounded-bl-md px-3.5 py-2.5">
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="al-pulse-dot h-1.5 w-1.5 rounded-full bg-[#17a24f]" style={{ animationDelay: `${d * 0.25}s` }} />
                  ))}
                  <span className="ml-1 text-[10px] font-bold text-muted-foreground">{t('aiThinking')}</span>
                </div>
              )}
            </div>

            {/* quick prompts */}
            {messages.length <= 1 && (
              <div className="al-noscroll flex gap-1.5 overflow-x-auto px-3 pb-1.5">
                {quicks.map((q) => (
                  <button key={q} className="neu shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold text-[var(--al-brown-2)]" onClick={() => send(q)}>
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* input */}
            <form
              className="flex items-center gap-2 border-t border-[var(--al-line)] p-2.5"
              onSubmit={(e) => {
                e.preventDefault()
                send()
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('aiPh')}
                className="neu-inset h-10 flex-1 rounded-xl px-3.5 text-[13px] font-medium outline-none placeholder:text-[var(--al-sand)]"
                aria-label={t('aiPh')}
              />
              <button type="submit" className="al-add flex h-10 w-10 items-center justify-center rounded-xl text-lg" disabled={busy} aria-label="Send">
                {lang === 'hi' ? 'अं' : '➤'}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
