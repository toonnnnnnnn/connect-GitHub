import { getStore } from '@netlify/blobs'
import type { Config, Context } from '@netlify/functions'

// Cross-device sync for the tab list: write from one device, read from
// another. No login system — this app is single-user, so there's just one
// shared record. Netlify Blobs needs no separate account/setup.
const STORE_NAME = 'tts-app-state'
const RECORD_KEY = 'tabs'

interface DocTab {
  id: string
  name: string
  text: string
}

interface TabsPayload {
  tabs: DocTab[]
  activeTabId: string
}

function isValidPayload(value: unknown): value is TabsPayload {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (!Array.isArray(v.tabs) || typeof v.activeTabId !== 'string') return false
  return v.tabs.every(
    (t) =>
      t &&
      typeof t === 'object' &&
      typeof (t as DocTab).id === 'string' &&
      typeof (t as DocTab).name === 'string' &&
      typeof (t as DocTab).text === 'string',
  )
}

export default async (req: Request, _context: Context) => {
  const store = getStore(STORE_NAME)

  if (req.method === 'GET') {
    const data = await store.get(RECORD_KEY, { type: 'json' })
    return new Response(JSON.stringify(data ?? null), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (req.method === 'POST') {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return new Response(JSON.stringify({ error: 'Request body ต้องเป็น JSON ที่ถูกต้อง' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!isValidPayload(body)) {
      return new Response(JSON.stringify({ error: 'รูปแบบข้อมูลไม่ถูกต้อง' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    await store.setJSON(RECORD_KEY, body)
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
}

export const config: Config = { path: '/api/tabs' }
