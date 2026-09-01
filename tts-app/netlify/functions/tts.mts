import type { Config, Context } from '@netlify/functions'

// Same job as server/index.js (the local dev proxy), packaged as a Netlify
// Function so the deployed site can call OpenAI TTS without exposing the key.
const MAX_INPUT_CHARS = 4096 // OpenAI's /v1/audio/speech input limit

const VALID_VOICES = new Set([
  'alloy',
  'ash',
  'ballad',
  'coral',
  'echo',
  'fable',
  'nova',
  'onyx',
  'sage',
  'shimmer',
  'verse',
])

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'ยังไม่ได้ตั้งค่า OPENAI_API_KEY ใน Netlify (Site settings → Environment variables)' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  let body: { text?: unknown; voice?: unknown; speed?: unknown }
  try {
    body = (await req.json()) as { text?: unknown; voice?: unknown; speed?: unknown }
  } catch {
    return new Response(JSON.stringify({ error: 'Request body ต้องเป็น JSON ที่ถูกต้อง' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const text = typeof body.text === 'string' ? body.text.slice(0, MAX_INPUT_CHARS) : ''
  const voice = typeof body.voice === 'string' && VALID_VOICES.has(body.voice) ? body.voice : 'alloy'
  const speed =
    typeof body.speed === 'number' && Number.isFinite(body.speed) ? Math.min(4, Math.max(0.25, body.speed)) : 1

  if (!text.trim()) {
    return new Response(JSON.stringify({ error: 'ต้องระบุข้อความ (text)' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'tts-1', input: text, voice, speed, response_format: 'mp3' }),
    })

    if (!openaiRes.ok) {
      const errText = await openaiRes.text()
      return new Response(JSON.stringify({ error: `OpenAI TTS error: ${errText.slice(0, 500)}` }), {
        status: openaiRes.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(openaiRes.body, {
      status: 200,
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `เรียก OpenAI ไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}` }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    )
  }
}

export const config: Config = { path: '/api/tts' }
