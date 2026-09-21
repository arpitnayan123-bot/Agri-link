'use client'

// Notification center — clay bell in the header with an unread badge and an
// inbox panel (order milestones, wallet credits, social harvest alerts).
// Server-backed: everything shown here was persisted at the moment it happened.

import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell } from 'lucide-react'
import { apiGet, apiPost, type NotificationsResponse } from '@/lib/agrilink-client'
import { makeT } from '@/lib/agrilink-i18n'
import { useAgriLink } from '@/store/agrilink'

function ago(iso: string, lang: 'en' | 'hi'): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (mins < 60) return lang === 'hi' ? `${mins} मिनट पहले` : `${mins}m ago`
  const h = Math.round(mins / 60)
  if (h < 24) return lang === 'hi' ? `${h} घंटे पहले` : `${h}h ago`
  const d = Math.round(h / 24)
  return lang === 'hi' ? `${d} दिन पहले` : `${d}d ago`
}

export function NotificationsBell() {
  const { lang, buyer } = useAgriLink()
  const t = makeT(lang)
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()
  const phone = buyer.phone.trim()

  const { data } = useQuery({
    queryKey: ['notifications', phone],
    queryFn: () => apiGet<NotificationsResponse>(`/api/notifications?phone=${encodeURIComponent(phone)}`),
    enabled: phone.length >= 6,
    refetchInterval: 25_000,
  })
  const unread = data?.unread ?? 0

  // Open = mark everything read (optimistic-ish: refetch after the POST).
  useEffect(() => {
    if (!open || unread === 0 || phone.length < 6) return
    const id = setTimeout(async () => {
      try {
        await apiPost('/api/notifications', { phone })
        await qc.invalidateQueries({ queryKey: ['notifications', phone] })
      } catch {
        /* badge stays — non-fatal */
      }
    }, 600)
    return () => clearTimeout(id)
  }, [open, unread, phone, qc])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <div ref={boxRef} className="relative">
      <button
        className="neu relative flex h-10 w-10 items-center justify-center rounded-full border-0 text-[var(--al-brown-2)] shadow-none transition active:scale-95"
        onClick={() => setOpen((o) => !o)}
        aria-label={`${t('notifications')}${unread > 0 ? ` (${unread})` : ''}`}
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <motion.span
            key={unread}
            initial={{ scale: 0.3 }}
            animate={{ scale: 1 }}
            className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-[#e11d48] px-1 text-[9px] font-black text-white shadow ring-2 ring-[var(--al-card)]"
          >
            {unread > 9 ? '9+' : unread}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            className="clay al-scroll absolute right-0 top-full z-50 mt-2 max-h-[26rem] w-[19rem] overflow-y-auto p-2 sm:w-96"
            role="dialog"
            aria-label={t('notifications')}
          >
            <div className="flex items-center justify-between px-2 pb-1.5 pt-1">
              <p className="text-[11px] font-black uppercase tracking-wider text-[var(--al-sand)]">🔔 {t('notifications')}</p>
              {unread > 0 && <span className="rounded-full bg-[#e11d48]/10 px-2 py-0.5 text-[9px] font-black text-[#e11d48]">{unread} new</span>}
            </div>
            {(data?.notifications ?? []).length === 0 ? (
              <div className="px-3 py-6 text-center">
                <span className="al-clay-emoji inline-flex h-12 w-12 items-center justify-center text-2xl">🔔</span>
                <p className="mt-2 text-[11px] font-bold text-[var(--al-ink-soft)]">{t('notifEmpty')}</p>
              </div>
            ) : (
              <ul className="space-y-1">
                {(data?.notifications ?? []).map((n) => (
                  <li
                    key={n.id}
                    className={`flex gap-2.5 rounded-2xl px-2.5 py-2 transition ${n.readAt ? 'bg-transparent' : 'bg-[var(--al-panel)]'}`}
                  >
                    <span className="al-clay-emoji flex h-9 w-9 shrink-0 items-center justify-center text-lg">{n.icon}</span>
                    <div className="min-w-0 flex-1 leading-snug">
                      <p className="flex items-center gap-1.5 text-[12px] font-extrabold">
                        <span className="line-clamp-1">{n.title}</span>
                        {!n.readAt && <span className="al-pulse-dot h-1.5 w-1.5 shrink-0 rounded-full bg-[#17a24f]" aria-label="unread" />}
                      </p>
                      <p className="line-clamp-2 text-[11px] font-medium text-[var(--al-ink-soft)]">{n.body}</p>
                      <p className="mt-0.5 text-[9px] font-bold text-[var(--al-sand)]">{ago(n.createdAt, lang)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
