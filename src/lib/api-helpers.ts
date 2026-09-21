// AgriLink — API helpers: auto-seed + uniform error handling.
// Routes return raw JSON payloads (client lib expects data directly).

import { NextResponse } from 'next/server'
import { ensureSeeded } from '@/lib/agrilink-seed'

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init)
}

export function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status })
}

export async function guard(handler: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    await ensureSeeded()
    return await handler()
  } catch (e) {
    console.error('[api]', e)
    return fail(e instanceof Error ? e.message : 'Internal error', 500)
  }
}

export function num(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}
