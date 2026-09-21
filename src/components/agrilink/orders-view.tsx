'use client'

// Orders view — order book with status timeline, live truck, payout proofs.
// Round-16: honest money management — cancel-with-refund (payout reversals +
// instant wallet refund), issue reporting on delivered orders, weekly-basket
// skip/stop/resume, and a "Your money" card (wallet ledger + referral program).

import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Ban, Copy, Gift, MessageCircle, ShieldCheck, Wallet } from 'lucide-react'
import { apiGet, apiPost, referralCodeFor, rs, slotLabel, type Order, type ReferralResponse, type WalletResponse } from '@/lib/agrilink-client'
import { makeT } from '@/lib/agrilink-i18n'
import { useAgriLink } from '@/store/agrilink'
import { useToast } from '@/hooks/use-toast'

const STEPS = ['PAID', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED'] as const

type WaUpdate = { id: string; orderId: string; code: string; status: string; farmer: string; etaMin: number; at: number }

function StatusTimeline({ order, lang }: { order: Order; lang: 'en' | 'hi' }) {
  const t = makeT(lang)
  const idx = STEPS.indexOf(order.status as (typeof STEPS)[number])
  const labels: Record<string, string> = {
    PAID: lang === 'hi' ? 'किसानों को भुगतान ⚡' : 'Paid to farmers',
    PACKED: lang === 'hi' ? 'खेत पर पैक' : 'Packed at farm',
    OUT_FOR_DELIVERY: lang === 'hi' ? 'रास्ते में' : 'Out for delivery',
    DELIVERED: lang === 'hi' ? 'पहुँच गया' : 'Delivered',
  }
  return (
    <div className="mt-3">
      <div className="relative flex justify-between">
        <div className="absolute left-0 right-0 top-3 h-1 rounded-full bg-[var(--al-inset)]" />
        <motion.div
          className="absolute left-0 top-3 h-1 rounded-full bg-gradient-to-r from-[#17a24f] to-[#84cc16]"
          initial={{ width: 0 }}
          animate={{ width: `${(idx / (STEPS.length - 1)) * 100}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
        {STEPS.map((s, i) => (
          <div key={s} className="relative z-10 flex flex-col items-center gap-1" style={{ width: 64 }}>
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-black shadow-sm ${
                i <= idx ? 'bg-[#17a24f] text-white' : 'bg-[var(--al-card)] text-[var(--al-timeline-idle)] ring-2 ring-[var(--al-inset)]'
              }`}
            >
              {i <= idx ? '✓' : i + 1}
            </span>
            <span className={`w-16 text-center text-[9px] font-bold leading-tight ${i <= idx ? 'text-[var(--al-ink)]' : 'text-[var(--al-timeline-idle)]'}`}>{labels[s]}</span>
          </div>
        ))}
      </div>
      {order.status !== 'DELIVERED' && (
        <p className="mt-3 flex flex-wrap items-center justify-center gap-1.5 rounded-xl bg-[var(--al-mango-panel)] py-1.5 text-[11px] font-black text-[var(--al-amber-deep)]">
          {order.slotKey && order.slotKey !== 'EXPRESS' ? (
            <span aria-hidden>🕒 {lang === 'hi' ? 'शेड्यूल' : 'Scheduled'} · {slotLabel(order.slotKey, lang)}</span>
          ) : (
            <>
              <span className="al-truck text-base" aria-hidden>🛵</span>
              {lang === 'hi' ? `ETA ~${order.etaMin} मिनट` : `Arriving in ~${order.etaMin} min`}
            </>
          )}
          {order.nextStageInMin != null && order.nextStageInMin > 0 && (
            <span className="rounded-full bg-[var(--al-glass)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--al-ink-soft)]">
              · {order.awaitingWindow ? (lang === 'hi' ? 'तुड़ाई शुरू' : 'Harvest begins in') : t('nextStage')} {order.nextStageInMin} min
            </span>
          )}
        </p>
      )}
    </div>
  )
}

function statusMessage(o: Pick<Order, 'code' | 'status' | 'etaMin' | 'items'>, lang: 'en' | 'hi'): string {
  const t = makeT(lang)
  const farmer = o.items[0]?.farmerName?.split(' ')[0] ?? 'Farmer'
  if (o.status === 'PACKED') return t('packedMsg').replace('{code}', o.code).replace('{farmer}', farmer)
  if (o.status === 'OUT_FOR_DELIVERY') return t('outMsg').replace('{code}', o.code).replace('{eta}', String(o.etaMin))
  return t('deliveredMsg').replace('{code}', o.code)
}

function WaFeed({ updates, lang }: { updates: WaUpdate[]; lang: 'en' | 'hi' }) {
  const t = makeT(lang)
  if (updates.length === 0) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="clay overflow-hidden rounded-3xl"
      role="log"
      aria-live="polite"
      aria-label={t('whatsappUpdates')}
    >
      <div className="flex items-center gap-2 bg-[#075E54] px-4 py-2.5 text-white">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
          <MessageCircle className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-xs font-black">{t('whatsappUpdates')}</p>
          <p className="text-[9px] font-semibold text-white/70">AgriLink · {t('whatsappFrom')}</p>
        </div>
        <span className="rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-black">{updates.length}</span>
      </div>
      <div className="al-scroll max-h-56 space-y-2 overflow-y-auto bg-[#ECE5DD] p-3">
        {updates.map((u) => (
          <motion.div key={u.id} initial={{ opacity: 0, scale: 0.96, x: 12 }} animate={{ opacity: 1, scale: 1, x: 0 }} className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[#DCF8C6] px-3 py-2 shadow-sm">
              <p className="text-[12px] font-semibold leading-snug text-[#1B1B1B]">
                {statusMessage({ code: u.code, status: u.status, etaMin: u.etaMin, items: [{ farmerName: u.farmer }] as Order['items'] }, lang)}
              </p>
              <p className="mt-0.5 text-right text-[9px] font-bold text-[#5B8A72]">
                {new Date(u.at).toLocaleTimeString(lang === 'hi' ? 'hi-IN' : 'en-IN', { hour: '2-digit', minute: '2-digit' })} ✓✓
              </p>
            </div>
          </motion.div>
        ))}
        <p className="text-center text-[9px] font-bold text-[var(--al-sand)]">{t('whatsappNote')}</p>
      </div>
    </motion.div>
  )
}

/* ─── Your money: wallet ledger + referral program (server-backed) ─────────── */

function MoneyCard({ phone, lang }: { phone: string; lang: 'en' | 'hi' }) {
  const t = makeT(lang)
  const { toast } = useToast()
  const qc = useQueryClient()
  const [openLedger, setOpenLedger] = useState(false)
  const [friendCode, setFriendCode] = useState('')
  const [busy, setBusy] = useState(false)

  const { data: wallet } = useQuery({
    queryKey: ['wallet', phone],
    queryFn: () => apiGet<WalletResponse>(`/api/wallet?phone=${encodeURIComponent(phone)}`),
    enabled: phone.length >= 6,
  })
  const { data: referral } = useQuery({
    queryKey: ['referrals', phone],
    queryFn: () => apiGet<ReferralResponse>(`/api/referrals?phone=${encodeURIComponent(phone)}`),
    enabled: phone.length >= 6,
  })

  const balance = Math.max(0, Math.floor(wallet?.balanceRs ?? 0))
  const code = referral?.code ?? referralCodeFor(phone)

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code)
      toast({ title: t('referralCopied') })
    } catch {
      /* headless blocks clipboard — silent */
    }
  }

  const applyCode = async () => {
    if (!friendCode.trim()) return
    setBusy(true)
    try {
      await apiPost('/api/referrals', { code: friendCode.trim(), phone })
      toast({ title: t('referralApplied') })
      setFriendCode('')
      qc.invalidateQueries({ queryKey: ['wallet', phone] })
      qc.invalidateQueries({ queryKey: ['referrals', phone] })
      qc.invalidateQueries({ queryKey: ['notifications', phone] })
    } catch (e) {
      toast({ title: t('referralErr').replace('{err}', e instanceof Error ? e.message : 'error') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="clay clay-green rounded-3xl p-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* wallet */}
        <div className="flex min-w-40 flex-1 items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--al-glass-strong)] shadow-sm">
            <Wallet className="h-4 w-4 text-[var(--al-green)]" />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="text-[10px] font-black uppercase tracking-wide text-[var(--al-olive)]">👛 {t('wallet')}</p>
            <p className="text-lg font-black text-[var(--al-ink)]">{rs(balance)}</p>
          </div>
          {wallet && wallet.txs.length > 0 && (
            <button className="ml-auto text-[10px] font-black text-[var(--al-olive-2)] underline-offset-2 hover:underline" onClick={() => setOpenLedger((o) => !o)} aria-expanded={openLedger}>
              {t('walletLedger')} {openLedger ? '▲' : '▼'}
            </button>
          )}
        </div>
        {/* referral */}
        <div className="flex min-w-48 flex-1 items-center gap-2 rounded-2xl bg-[var(--al-glass)] p-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/40 shadow-sm">
            <Gift className="h-4 w-4 text-[#e11d48]" />
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[10px] font-black text-[var(--al-ink)]">{t('referralTitle')}</p>
            <p className="truncate text-[9px] font-semibold text-[var(--al-ink-soft)]">
              {t('referralCode')}: <span className="font-mono font-black text-[var(--al-green)]">{code}</span>
              {referral && referral.invites > 0 && <> · {referral.invites} {t('invites')}</>}
            </p>
          </div>
          <button className="neu flex h-8 shrink-0 items-center gap-1 rounded-xl border-0 px-2.5 text-[10px] font-black" onClick={copyCode}>
            <Copy className="h-3 w-3" /> {t('referralCopy')}
          </button>
        </div>
      </div>

      {openLedger && wallet && (
        <div className="al-scroll mt-3 max-h-40 space-y-1 overflow-y-auto rounded-2xl bg-[var(--al-glass)] p-2">
          {wallet.txs.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-[11px] font-bold">
              <span className="min-w-0 truncate text-[var(--al-ink-soft)]">
                {tx.type === 'REFUND' ? '↩️' : tx.type === 'REFERRAL' ? '🎁' : tx.type === 'WELCOME' ? '🌱' : '🛒'} {tx.note}
              </span>
              <span className={`shrink-0 font-black ${tx.amountRs >= 0 ? 'text-[var(--al-green)]' : 'text-[var(--al-brown-2)]'}`}>
                {tx.amountRs >= 0 ? '+' : '−'}{rs(Math.abs(tx.amountRs))}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* apply a friend's code */}
      <div className="mt-2.5 flex items-center gap-2">
        <input
          value={friendCode}
          onChange={(e) => setFriendCode(e.target.value.toUpperCase())}
          placeholder={t('referralApplyPh')}
          className="neu-inset min-w-0 flex-1 rounded-xl px-3 py-2 text-[11px] font-bold outline-none placeholder:text-[var(--al-sand)]"
          aria-label={t('referralApplyPh')}
        />
        <button
          className="al-add flex h-9 shrink-0 items-center gap-1 rounded-xl px-3.5 text-[10px] font-black disabled:opacity-50"
          disabled={busy || !friendCode.trim()}
          onClick={applyCode}
        >
          <Gift className="h-3.5 w-3.5" /> {t('referralApplyBtn')}
        </button>
      </div>
    </div>
  )
}

/* ─── Order card action: cancel (inline confirm) / report issue ────────────── */

function CancelBox({ order, lang }: { order: Order; lang: 'en' | 'hi' }) {
  const t = makeT(lang)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()
  const qc = useQueryClient()

  if (!open) {
    return (
      <button
        className="flex h-8 items-center gap-1 rounded-xl bg-red-500/10 px-3 text-[10px] font-black text-red-600 transition hover:bg-red-500/20 dark:text-red-400"
        onClick={() => setOpen(true)}
      >
        <Ban className="h-3 w-3" /> {t('cancelOrder')}
      </button>
    )
  }

  const doCancel = async () => {
    setBusy(true)
    try {
      await apiPost(`/api/orders/${order.code}`, { action: 'CANCEL', reason: reason.trim() || undefined })
      toast({ title: t('cancelDone').replace('{n}', String(Math.round(order.totalRs))) })
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['wallet'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    } catch {
      toast({ title: t('cancelFail') })
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }

  return (
    <div className="w-full rounded-2xl bg-red-500/5 p-3 ring-1 ring-red-500/20">
      <p className="text-[11px] font-black text-red-600 dark:text-red-400">⚠️ {t('cancelTitle')}</p>
      <p className="mt-0.5 text-[10px] font-semibold text-[var(--al-ink-soft)]">{t('cancelBody').replace('{n}', String(Math.round(order.totalRs)))}</p>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t('cancelReasonPh')}
        className="neu-inset mt-2 w-full rounded-xl px-3 py-2 text-[11px] font-semibold outline-none placeholder:text-[var(--al-sand)]"
        aria-label={t('cancelReasonPh')}
      />
      <div className="mt-2 flex gap-2">
        <button
          className="flex h-8 flex-1 items-center justify-center rounded-xl bg-red-600 text-[10px] font-black text-white transition hover:bg-red-700 disabled:opacity-60"
          disabled={busy}
          onClick={doCancel}
        >
          {t('confirmCancel')}
        </button>
        <button className="neu flex h-8 flex-1 items-center justify-center rounded-xl border-0 text-[10px] font-black" onClick={() => setOpen(false)}>
          {t('keepOrder')}
        </button>
      </div>
    </div>
  )
}

function IssueBox({ order, lang }: { order: Order; lang: 'en' | 'hi' }) {
  const t = makeT(lang)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()
  const qc = useQueryClient()

  if (order.issueStatus === 'OPEN') {
    return (
      <span className="inline-flex h-8 items-center gap-1 rounded-xl bg-[var(--al-mango-panel)] px-3 text-[10px] font-black text-[var(--al-amber-deep)]">
        🛟 {t('issueOpen')}
      </span>
    )
  }
  if (!open) {
    return (
      <button
        className="flex h-8 items-center gap-1 rounded-xl bg-[var(--al-mango-panel)] px-3 text-[10px] font-black text-[var(--al-amber-deep)] transition hover:brightness-95"
        onClick={() => setOpen(true)}
      >
        🛟 {t('reportIssue')}
      </button>
    )
  }

  const send = async () => {
    if (!text.trim()) return
    setBusy(true)
    try {
      await apiPost(`/api/orders/${order.code}`, { action: 'ISSUE', reason: text.trim() })
      toast({ title: t('issueSent') })
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    } catch {
      /* non-fatal */
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }

  return (
    <div className="w-full rounded-2xl bg-[var(--al-mango-panel-2)] p-3 ring-1 ring-[var(--al-amber)]/20">
      <p className="text-[11px] font-black text-[var(--al-amber-deep)]">🛟 {t('issueTitle')}</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('issuePh')}
        rows={2}
        className="neu-inset mt-1.5 w-full rounded-xl px-3 py-2 text-[11px] font-semibold outline-none placeholder:text-[var(--al-sand)]"
        aria-label={t('issueTitle')}
      />
      <div className="mt-2 flex gap-2">
        <button
          className="al-add flex h-8 flex-1 items-center justify-center rounded-xl text-[10px] font-black disabled:opacity-60"
          disabled={busy || !text.trim()}
          onClick={send}
        >
          {t('issueSend')}
        </button>
        <button className="neu flex h-8 flex-1 items-center justify-center rounded-xl border-0 text-[10px] font-black" onClick={() => setOpen(false)}>
          {t('reviewCancel')}
        </button>
      </div>
    </div>
  )
}

/* ─── Weekly-basket management: skip / stop / resume ───────────────────────── */

function SubManage({ order, lang }: { order: Order; lang: 'en' | 'hi' }) {
  const t = makeT(lang)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const { toast } = useToast()
  const qc = useQueryClient()
  const phone = order.buyerPhone
  const active = Boolean(order.subscription && order.nextDeliveryAt)

  const act = async (action: 'SKIP' | 'CANCEL' | 'RESUME') => {
    setBusy(true)
    try {
      await apiPost('/api/subscription', { phone, action })
      toast({ title: action === 'SKIP' ? t('subSkipped') : action === 'CANCEL' ? t('subStopped') : t('subResumed') })
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['notifications', phone] })
    } catch {
      toast({ title: t('subFail') })
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }

  if (!active) {
    return (
      <button
        className="flex h-8 items-center gap-1 rounded-xl bg-[var(--al-chip-2)] px-3 text-[10px] font-black text-[var(--al-ink-soft)] transition hover:brightness-95"
        disabled={busy}
        onClick={() => act('RESUME')}
      >
        🔁 {t('resumeSub')}
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button className="flex h-8 items-center gap-1 rounded-xl bg-[var(--al-chip-2)] px-3 text-[10px] font-black text-[var(--al-ink-soft)]" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        ⚙️ {t('manageSub')} {open ? '▲' : '▼'}
      </button>
      {open && (
        <>
          <button className="flex h-8 items-center rounded-xl bg-[var(--al-mango-panel)] px-3 text-[10px] font-black text-[var(--al-amber-deep)] transition hover:brightness-95 disabled:opacity-60" disabled={busy} onClick={() => act('SKIP')}>
            ⏭️ {t('skipNext')}
          </button>
          <button className="flex h-8 items-center rounded-xl bg-red-500/10 px-3 text-[10px] font-black text-red-600 transition hover:bg-red-500/20 dark:text-red-400 disabled:opacity-60" disabled={busy} onClick={() => act('CANCEL')}>
            <Ban className="h-3 w-3" /> {t('stopSub')}
          </button>
        </>
      )}
    </div>
  )
}

function OrderCard({ order: o, lang }: { order: Order; lang: 'en' | 'hi' }) {
  const t = makeT(lang)
  const { openProduct } = useAgriLink()
  const cancelled = o.status === 'CANCELLED'

  return (
    <motion.article initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className={`clay rounded-3xl p-4 ${cancelled ? 'opacity-90' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-black">
            {t('orderCode')} {o.code}
            {!cancelled && o.status !== 'DELIVERED' && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[var(--al-chip-2)] px-2 py-0.5 align-middle text-[9px] font-black uppercase tracking-wide text-[var(--al-ink-soft)]">
                <span className="al-pulse-dot h-1.5 w-1.5 rounded-full bg-[#17a24f]" />
                {t('stageLive')}
              </span>
            )}
          </p>
          <p className="text-[10px] font-semibold text-muted-foreground">
            {t('when')}: {new Date(o.createdAt).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${cancelled ? 'bg-red-500/10 text-red-600 dark:text-red-400' : o.status === 'DELIVERED' ? 'bg-[var(--al-chip-2)] text-[var(--al-ink-soft)]' : 'bg-[var(--al-mango-panel)] text-[var(--al-amber-deep)]'}`}>
          {cancelled ? t('cancelled') : o.status === 'DELIVERED' ? t('delivered') : o.status === 'OUT_FOR_DELIVERY' ? t('outForDelivery') : o.status === 'PACKED' ? t('packed') : t('paid')}
        </span>
      </div>

      {/* cancelled banner — honest money trail */}
      {cancelled && (
        <div className="mt-2 rounded-2xl bg-red-500/5 p-2.5 ring-1 ring-red-500/15">
          <p className="text-[11px] font-black text-red-600 dark:text-red-400">
            ↩️ {t('cancelled')} · {t('cancelReasonLabel')}: {o.cancelReason}
          </p>
          {(o.refundRs ?? 0) > 0 && (
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-[var(--al-ink-soft)]">
              <span className="rounded-full bg-[var(--al-glass)] px-2 py-0.5 font-black text-[var(--al-green)]">
                {t('cancelChip').replace('{n}', String(Math.round(o.refundRs ?? 0)))}
              </span>
              {o.refundRef && <span className="rounded-full bg-[var(--al-glass)] px-2 py-0.5 font-mono text-[9px]">{o.refundRef}</span>}
            </p>
          )}
        </div>
      )}

      {/* delivery slot chip — scheduled orders surface their window */}
      {!cancelled && o.slotKey && o.slotKey !== 'EXPRESS' && (
        <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[var(--al-glass)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--al-ink-soft)]">
          🕒 {slotLabel(o.slotKey, lang)}
        </p>
      )}

      {/* tip chip — visible gratitude */}
      {!cancelled && (o.tipRs ?? 0) > 0 && (
        <p className="ml-1.5 mt-1.5 inline-flex items-center gap-1 rounded-full bg-[var(--al-mango-panel)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--al-amber-deep)]">
          🛵 {t('tipLine')} {rs(o.tipRs)}
        </p>
      )}

      {/* wallet chip — money saved via wallet */}
      {!cancelled && (o.walletUsedRs ?? 0) > 0 && (
        <p className="ml-1.5 mt-1.5 inline-flex items-center gap-1 rounded-full bg-[var(--al-chip-2)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--al-ink-soft)]">
          👛 {t('walletLine').replace('{n}', String(o.walletUsedRs))}
        </p>
      )}

      {/* weekly basket subscription — recurring value is visible + manageable */}
      {!cancelled && o.subscription && (
        <p className="ml-1.5 mt-1.5 inline-flex items-center gap-1 rounded-full bg-[var(--al-chip-2)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--al-ink-soft)] ring-1 ring-[var(--al-green)]/25">
          🔁 {lang === 'hi' ? 'साप्ताहिक' : 'Weekly'}
          {o.nextDeliveryAt && (
            <span className="font-bold text-[var(--al-olive-2)]">
              · {lang === 'hi' ? 'अगली' : 'next'} {new Date(o.nextDeliveryAt).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { dateStyle: 'medium' })}
            </span>
          )}
        </p>
      )}

      {/* items — DELIVERED items get a "Rate" nudge → product sheet review form */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {o.items.map((it) => (
          <span key={it.id} className="flex items-center gap-1.5 rounded-xl bg-[var(--al-panel-2)] px-2 py-1.5 text-[11px] font-bold">
            <span className="text-base">{it.emoji}</span>
            {it.name} ×{it.qty}
            {o.status === 'DELIVERED' && (
              <button
                className="ml-0.5 flex items-center gap-0.5 rounded-full bg-[var(--al-mango-panel)] px-1.5 py-0.5 text-[9px] font-black text-[var(--al-amber-deep)] transition hover:scale-105 active:scale-95"
                onClick={() => openProduct(it.productId)}
                aria-label={`${t('rateOrder')}: ${it.name}`}
              >
                ⭐ {t('rateOrder')}
              </button>
            )}
          </span>
        ))}
      </div>

      {/* payout proofs */}
      {!cancelled && (
        <div className="clay-green mt-3 rounded-2xl p-2.5">
          <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-[var(--al-ink)]">
            <ShieldCheck className="h-3.5 w-3.5" /> {t('payoutProof')} — {rs(o.farmerPayoutRs)}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {[...new Map(o.items.filter((i) => i.payoutRef).map((i) => [i.farmerName, i])).values()].map((it) => (
              <span key={it.id} className="rounded-full bg-[var(--al-glass)] px-2 py-0.5 font-mono text-[9px] font-semibold text-[var(--al-olive-2)]">
                {it.farmerAvatar} {it.farmerName.split(' ')[0]} · {it.payoutRef}
              </span>
            ))}
          </div>
        </div>
      )}

      {!cancelled && <StatusTimeline order={o} lang={lang} />}

      {/* actions row: cancel while early, issues after delivery, manage sub */}
      {(!cancelled || o.subscription) && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-dashed pt-2.5">
          {(o.status === 'PAID' || o.status === 'PACKED') && <CancelBox order={o} lang={lang} />}
          {o.status === 'DELIVERED' && <IssueBox order={o} lang={lang} />}
          {!cancelled && o.subscription && <SubManage order={o} lang={lang} />}
          {cancelled && o.subscription && <SubManage order={o} lang={lang} />}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-dashed pt-2.5 text-xs font-bold">
        <span className="text-muted-foreground">{o.buyerName} · {o.buyerCity}</span>
        <span className="text-sm font-black">{rs(o.totalRs)}</span>
      </div>
    </motion.article>
  )
}

export function OrdersView() {
  const { lang, buyer } = useAgriLink()
  const t = makeT(lang)
  const { toast } = useToast()
  const [waUpdates, setWaUpdates] = useState<WaUpdate[]>([])
  const prevStatusRef = useRef<Map<string, string>>(new Map())
  const firstLoadRef = useRef(true)
  const phone = buyer.phone.trim()

  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders', phone],
    queryFn: () => apiGet<Order[]>(`/api/orders${phone ? `?phone=${encodeURIComponent(phone)}` : ''}`),
    // Poll so the server-side demo lifecycle (auto-advance) is visible live.
    refetchInterval: 10_000,
  })

  // Detect stage transitions → WhatsApp-style toast + feed entry.
  // The announce (toast + feed) is deferred to a 0ms timeout: the toast
  // re-render would otherwise re-run this effect and cancel the update.
  // prevStatusRef is only advanced INSIDE the timeout, so a cancelled run
  // simply re-detects the same transitions next pass — no duplicates, no loss.
  useEffect(() => {
    if (!orders) return
    const fresh: WaUpdate[] = []
    for (const o of orders) {
      const prev = prevStatusRef.current.get(o.id)
      if (!firstLoadRef.current && prev && prev !== o.status && o.status !== 'CANCELLED') {
        fresh.push({ id: `${o.id}-${o.status}`, orderId: o.id, code: o.code, status: o.status, farmer: o.items[0]?.farmerName ?? 'Farmer', etaMin: o.etaMin, at: Date.now() })
      }
    }
    firstLoadRef.current = false
    if (fresh.length === 0) {
      for (const o of orders) prevStatusRef.current.set(o.id, o.status)
      return
    }
    const batch = fresh
    const tl = makeT(lang)
    const id = setTimeout(() => {
      for (const u of batch) prevStatusRef.current.set(u.orderId, u.status)
      setWaUpdates((u) => {
        const seen = new Set(u.map((x) => x.id))
        const add = batch.filter((x) => !seen.has(x.id))
        return add.length ? [...add, ...u].slice(0, 12) : u
      })
      for (const u of batch) {
        const msg = statusMessage({ code: u.code, status: u.status, etaMin: u.etaMin, items: [{ farmerName: u.farmer }] as Order['items'] }, lang)
        toast({ title: `💬 ${tl('whatsappFrom')}`, description: msg })
      }
    }, 0)
    return () => clearTimeout(id)
  }, [orders, lang, toast])

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 px-4 py-8">
        {[1, 2].map((i) => (
          <div key={i} className="clay h-44 animate-pulse rounded-3xl" />
        ))}
      </div>
    )
  }

  if (!orders?.length) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <span className="al-clay-emoji al-float inline-flex h-20 w-20 items-center justify-center rounded-full text-5xl">📦</span>
        <p className="mt-4 text-sm font-bold text-muted-foreground">{t('noOrders')}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <h2 className="font-display text-2xl font-extrabold">📦 {t('ordersTitle')}</h2>
      {phone.length >= 6 && <MoneyCard phone={phone} lang={lang} />}
      <WaFeed updates={waUpdates} lang={lang} />
      {orders.map((o) => (
        <OrderCard key={o.id} order={o} lang={lang} />
      ))}
    </div>
  )
}
