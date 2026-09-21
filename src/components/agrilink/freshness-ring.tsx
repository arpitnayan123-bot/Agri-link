'use client'

// Freshness ring — animated SVG dial showing the AI freshness score.
// Score is live (decays from harvestedAt) and color-coded.
// Uses useSyncExternalStore: SSR renders '·' (stable), client ticks every 60s.

import { useSyncExternalStore } from 'react'
import { freshnessColor, freshnessLabel, freshnessScore } from '@/lib/agrilink-client'

function subscribe(cb: () => void) {
  const id = setInterval(cb, 60_000)
  return () => clearInterval(id)
}

export function FreshnessRing({ harvestedAt, size = 44, showLabel = false, lang = 'en' }: { harvestedAt: string; size?: number; showLabel?: boolean; lang?: 'en' | 'hi' }) {
  const score = useSyncExternalStore(
    subscribe,
    () => freshnessScore(harvestedAt),
    () => 0 // server snapshot: neutral, client fills real score post-hydration
  )

  const R = 16
  const C = 2 * Math.PI * R
  const dash = (score / 100) * C
  const color = freshnessColor(score)
  const live = score > 0

  return (
    <div className="flex items-center gap-1.5" title={`AI freshness: ${score}%`}>
      <svg width={size} height={size} viewBox="0 0 40 40" role="img" aria-label={`AI freshness ${score}%`}>
        <circle cx="20" cy="20" r={R} fill="none" strokeWidth="4.5" style={{ stroke: 'var(--al-track, #EDE6D2)' }} />
        {live && (
          <circle
            cx="20"
            cy="20"
            r={R}
            fill="none"
            stroke={color}
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${C - dash}`}
            transform="rotate(-90 20 20)"
            style={{ transition: 'stroke-dasharray 0.8s ease, stroke 0.4s ease' }}
          />
        )}
        <text x="20" y="24" textAnchor="middle" fontSize="11" fontWeight="800" fill={live ? color : '#B7AB8C'}>
          {live ? score : '·'}
        </text>
      </svg>
      {showLabel && live && (
        <span className="text-[10px] font-bold leading-tight" style={{ color }}>
          {freshnessLabel(score, lang)}
        </span>
      )}
    </div>
  )
}
