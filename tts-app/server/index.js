import { createServer } from 'node:http'

// Small local proxy so the browser never holds the OpenAI API key directly.
// Run with: node --env-file=server/.env server/index.js
// (requires Node 20.6+ for --env-file; see server/.env.example)

const PORT = process.env.TTS_SERVER_PORT ? Number(process.env.TTS_SERVER_PORT) : 8787
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
// localhost and 127.0.0.1 are different CORS origins even though they're the
// same machine, so both need to be allowed for the default Vite dev port.
const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:5183', 'http://127.0.0.1:5183']
const ALLOWED_ORIGINS = process.env.TTS_SERVER_ALLOWED_ORIGIN
  ? process.env.TTS_SERVER_ALLOWED_ORIGIN.split(',').map((s) => s.trim())
  : DEFAULT_ALLOWED_ORIGINS
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

if (!OPENAI_API_KEY) {
  console.error(
    'Missing OPENAI_API_KEY.\nCreate server/.env (copy server/.env.example) and set OPENAI_API_KEY=sk-...',
  )
  process.exit(1)
}

function setCors(req, res) {
  const origin = req.headers.origin
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

async function readJsonBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}

const server = createServer(async (req, res) => {
  setCors(req, res)

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, { ok: true })
    return
  }

  if (req.method === 'POST' && req.url === '/api/tts') {
    let body
    try {
      body = await readJsonBody(req)
    } catch {
      sendJson(res, 400, { error: 'Request body ต้องเป็น JSON ที่ถูกต้อง' })
      return
    }

    const text = typeof body.text === 'string' ? body.text.slice(0, MAX_INPUT_CHARS) : ''
    const voice = VALID_VOICES.has(body.voice) ? body.voice : 'alloy'
    const speed = typeof body.speed === 'number' && Number.isFinite(body.speed) ? Math.min(4, Math.max(0.25, body.speed)) : 1

    if (!text.trim()) {
      sendJson(res, 400, { error: 'ต้องระบุข้อความ (text)' })
      return
    }

    try {
      const openaiRes = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: 'tts-1', input: text, voice, speed, response_format: 'mp3' }),
      })

      if (!openaiRes.ok) {
        const errText = await openaiRes.text()
        sendJson(res, openaiRes.status, { error: `OpenAI TTS error: ${errText.slice(0, 500)}` })
        return
      }

      const arrayBuffer = await openaiRes.arrayBuffer()
      res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Content-Length': arrayBuffer.byteLength,
        'Cache-Control': 'no-store',
      })
      res.end(Buffer.from(arrayBuffer))
    } catch (err) {
      sendJson(res, 502, { error: `เรียก OpenAI ไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}` })
    }
    return
  }

  sendJson(res, 404, { error: 'not found' })
})

server.listen(PORT, () => {
  console.log(`TTS proxy server listening on http://localhost:${PORT}`)
  console.log(`Allowing requests from origins: ${ALLOWED_ORIGINS.join(', ')}`)
})
