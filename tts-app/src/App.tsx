import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Clipboard,
  Download,
  FastForward,
  Loader2,
  Moon,
  Pause,
  Play,
  Rewind,
  RotateCcw,
  Sparkles,
  Square,
  Sun,
  Trash2,
  Volume2,
} from 'lucide-react'
import { TextEditor, type TextEditorHandle } from './components/TextEditor'
import { RangeSlider } from './components/RangeSlider'
import { ThaiVoiceHelp } from './components/ThaiVoiceHelp'
import { TabBar, type DocTab } from './components/TabBar'
import { useVoices } from './hooks/useVoices'
import { useSpeechPlayer } from './hooks/useSpeechPlayer'
import { useAiSpeechPlayer } from './hooks/useAiSpeechPlayer'
import { useAudioRecorder } from './hooks/useAudioRecorder'
import { countWords, hasThai } from './lib/textChunking'
import { findVoiceByURI, groupVoices, hasThaiVoice } from './lib/voices'
import { DEFAULT_OPENAI_VOICE, OPENAI_VOICES, isOpenAiVoiceId, type OpenAiVoiceId } from './lib/openaiVoices'

const DRAFT_KEY = 'tts-app:draft'
const TABS_KEY = 'tts-app:tabs'
const DARK_KEY = 'tts-app:dark'
const VOICE_KEY = 'tts-app:voice'
const RATE_KEY = 'tts-app:rate'
const PITCH_KEY = 'tts-app:pitch'
const MULTI_VOICE_KEY = 'tts-app:multi-voice'
const ENGINE_KEY = 'tts-app:engine'
const OPENAI_VOICE_KEY = 'tts-app:openai-voice'

type Engine = 'browser' | 'openai'

// In production (deployed on Netlify), /api/tts is same-origin via the
// redirect in netlify.toml, so an empty base is correct. In local dev it
// points at server/index.js (run with `npm run server`).
const AI_SERVER_URL =
  (import.meta.env.VITE_TTS_SERVER_URL as string | undefined) ?? (import.meta.env.PROD ? '' : 'http://localhost:8787')

const TABS_SYNC_ENDPOINT = '/api/tabs'
const TABS_SYNC_DEBOUNCE_MS = 800

function createTab(name: string, text = ''): DocTab {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `tab-${Date.now()}-${Math.random()}`
  return { id, name, text }
}

interface TabState {
  tabs: DocTab[]
  activeTabId: string
}

function readInitialTabState(): TabState {
  try {
    const raw = localStorage.getItem(TABS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<TabState>
      if (Array.isArray(parsed.tabs) && parsed.tabs.length > 0) {
        const activeTabId =
          typeof parsed.activeTabId === 'string' && parsed.tabs.some((t) => t.id === parsed.activeTabId)
            ? parsed.activeTabId
            : parsed.tabs[0].id
        return { tabs: parsed.tabs, activeTabId }
      }
    }
  } catch {
    /* ignore */
  }

  // Migrate the old single-draft format from earlier versions of the app.
  let legacyText = ''
  try {
    legacyText = localStorage.getItem(DRAFT_KEY) ?? ''
  } catch {
    /* ignore */
  }
  const first = createTab('แท็บ 1', legacyText)
  return { tabs: [first], activeTabId: first.id }
}

function readInitialDark(): boolean {
  try {
    const stored = localStorage.getItem(DARK_KEY)
    if (stored !== null) return stored === '1'
  } catch {
    /* ignore */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

export default function App() {
  const editorRef = useRef<TextEditorHandle>(null)
  const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

  const [darkMode, setDarkMode] = useState(readInitialDark)
  const [tabState, setTabState] = useState<TabState>(readInitialTabState)
  const activeTab = tabState.tabs.find((t) => t.id === tabState.activeTabId) ?? tabState.tabs[0]
  const [debouncedText, setDebouncedText] = useState(() => activeTab.text)
  const [playbackSnapshot, setPlaybackSnapshot] = useState('')
  const [editedNotice, setEditedNotice] = useState(false)
  const [copyNotice, setCopyNotice] = useState<string | null>(null)
  const scrubBarRef = useRef<HTMLDivElement>(null)
  const [liveFraction, setLiveFraction] = useState(0)
  const [dragFraction, setDragFraction] = useState<number | null>(null)

  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(() => {
    try {
      return localStorage.getItem(VOICE_KEY)
    } catch {
      return null
    }
  })
  const [userPickedVoice, setUserPickedVoice] = useState(() => selectedVoiceURI !== null)
  const [rate, setRate] = useState<number>(() => {
    const raw = localStorage.getItem(RATE_KEY)
    const stored = raw === null ? NaN : Number(raw)
    return Number.isFinite(stored) && stored >= 0.5 && stored <= 2 ? stored : 1
  })
  const [pitch, setPitch] = useState<number>(() => {
    const raw = localStorage.getItem(PITCH_KEY)
    const stored = raw === null ? NaN : Number(raw)
    return Number.isFinite(stored) && stored >= 0 && stored <= 2 ? stored : 1
  })
  const [multiVoice, setMultiVoice] = useState<boolean>(() => localStorage.getItem(MULTI_VOICE_KEY) === '1')
  const [engine, setEngine] = useState<Engine>(() => {
    const stored = localStorage.getItem(ENGINE_KEY)
    return stored === 'openai' ? 'openai' : 'browser'
  })
  const [openaiVoiceId, setOpenaiVoiceId] = useState<OpenAiVoiceId>(() => {
    const stored = localStorage.getItem(OPENAI_VOICE_KEY)
    return stored && isOpenAiVoiceId(stored) ? stored : DEFAULT_OPENAI_VOICE
  })

  const voices = useVoices()
  const voiceGroups = useMemo(() => groupVoices(voices), [voices])
  const selectedVoice = useMemo(() => findVoiceByURI(voices, selectedVoiceURI), [voices, selectedVoiceURI])
  const thaiMissing = voices.length > 0 && !hasThaiVoice(voices)
  const isThaiText = useMemo(() => hasThai(debouncedText), [debouncedText])

  const browserPlayer = useSpeechPlayer({ voices, selectedVoice, rate, pitch, multiVoice })
  const aiPlayer = useAiSpeechPlayer({ apiBaseUrl: AI_SERVER_URL, voice: openaiVoiceId, speed: rate })
  const player = engine === 'openai' ? aiPlayer : browserPlayer
  const recorder = useAudioRecorder()

  useEffect(() => {
    // Whenever the engine is about to change (or on unmount), make sure
    // whichever player was active stops — otherwise it can keep speaking
    // silently in the background after the UI switches to the other one.
    return () => {
      browserPlayer.stop()
      aiPlayer.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine])

  useEffect(() => {
    try {
      localStorage.setItem(TABS_KEY, JSON.stringify(tabState))
    } catch {
      /* ignore */
    }
  }, [tabState])

  // Cross-device sync: on mount, pull the latest saved state from the cloud
  // (Netlify Blobs via /api/tabs) so opening the app on another device shows
  // what you last saved elsewhere. Silently falls back to local-only state
  // if the endpoint isn't reachable (e.g. plain `npm run dev` without
  // Netlify, or offline).
  const [hasHydratedFromCloud, setHasHydratedFromCloud] = useState(false)
  useEffect(() => {
    let cancelled = false
    fetch(TABS_SYNC_ENDPOINT)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { tabs?: DocTab[]; activeTabId?: string } | null) => {
        if (cancelled || !data || !Array.isArray(data.tabs) || data.tabs.length === 0) return
        const nextActiveTabId =
          typeof data.activeTabId === 'string' && data.tabs.some((t) => t.id === data.activeTabId)
            ? data.activeTabId
            : data.tabs[0].id
        setTabState({ tabs: data.tabs, activeTabId: nextActiveTabId })
        setDebouncedText(data.tabs.find((t) => t.id === nextActiveTabId)?.text ?? '')
      })
      .catch(() => {
        /* offline or sync endpoint unavailable — keep local state */
      })
      .finally(() => {
        if (!cancelled) setHasHydratedFromCloud(true)
      })
    return () => {
      cancelled = true
    }
    // Intentionally runs once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Push tab changes to the cloud, debounced. Waits for the initial pull
  // above to finish first, so this can't race ahead and overwrite newer data
  // saved from another device before we've even read it.
  useEffect(() => {
    if (!hasHydratedFromCloud) return
    const timer = window.setTimeout(() => {
      fetch(TABS_SYNC_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tabState),
      }).catch(() => {
        /* offline — localStorage still has the latest edit */
      })
    }, TABS_SYNC_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [tabState, hasHydratedFromCloud])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    try {
      localStorage.setItem(DARK_KEY, darkMode ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [darkMode])

  useEffect(() => {
    if (voices.length === 0) return
    const selectedStillExists = voices.some((v) => v.voiceURI === selectedVoiceURI)
    if (userPickedVoice && selectedStillExists) return
    const preferredLang = isThaiText ? 'th' : 'en'
    const match = voices.find((v) => v.lang.toLowerCase().startsWith(preferredLang))
    const target = match ?? voices[0]
    if (target && target.voiceURI !== selectedVoiceURI) setSelectedVoiceURI(target.voiceURI)
  }, [voices, isThaiText, userPickedVoice, selectedVoiceURI])

  useEffect(() => {
    if (!editedNotice) return
    const timer = setTimeout(() => setEditedNotice(false), 3000)
    return () => clearTimeout(timer)
  }, [editedNotice])

  useEffect(() => {
    if (!copyNotice) return
    const timer = setTimeout(() => setCopyNotice(null), 2500)
    return () => clearTimeout(timer)
  }, [copyNotice])

  useEffect(() => {
    if (player.playState === 'idle') {
      setLiveFraction(0)
      return
    }
    const update = () => setLiveFraction(player.getProgressFraction(playbackSnapshot))
    update()
    const timer = window.setInterval(update, 200)
    return () => clearInterval(timer)
    // player.getProgressFraction has a stable identity across renders (unlike
    // the `player` object itself), so it's safe to depend on directly here.
  }, [player.playState, player.getProgressFraction, playbackSnapshot])

  const charCount = debouncedText.length
  const wordCount = useMemo(() => countWords(debouncedText), [debouncedText])

  const handleDebouncedChange = (value: string) => {
    setDebouncedText(value)
    setTabState((prev) => ({
      ...prev,
      tabs: prev.tabs.map((t) => (t.id === prev.activeTabId ? { ...t, text: value } : t)),
    }))
  }

  const handleAddTab = () => {
    player.stop()
    const newTab = createTab(`แท็บ ${tabState.tabs.length + 1}`)
    setTabState((prev) => ({ tabs: [...prev.tabs, newTab], activeTabId: newTab.id }))
    setDebouncedText('')
    setPlaybackSnapshot('')
  }

  const handleSelectTab = (id: string) => {
    if (id === tabState.activeTabId) return
    const target = tabState.tabs.find((t) => t.id === id)
    if (!target) return
    player.stop()
    setTabState((prev) => ({ ...prev, activeTabId: id }))
    setDebouncedText(target.text)
    setPlaybackSnapshot('')
  }

  const handleRenameTab = (id: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setTabState((prev) => ({
      ...prev,
      tabs: prev.tabs.map((t) => (t.id === id ? { ...t, name: trimmed } : t)),
    }))
  }

  const handleCloseTab = (id: string) => {
    if (tabState.tabs.length <= 1) return
    const remaining = tabState.tabs.filter((t) => t.id !== id)
    const wasActive = id === tabState.activeTabId
    const nextActiveId = wasActive ? remaining[0].id : tabState.activeTabId
    setTabState({ tabs: remaining, activeTabId: nextActiveId })
    if (wasActive) {
      player.stop()
      setDebouncedText(remaining.find((t) => t.id === nextActiveId)?.text ?? '')
      setPlaybackSnapshot('')
    }
  }

  const handleEditWhilePlaying = () => {
    player.stop()
    setEditedNotice(true)
  }

  const handleVoiceChange = (uri: string) => {
    setUserPickedVoice(true)
    setSelectedVoiceURI(uri)
    try {
      localStorage.setItem(VOICE_KEY, uri)
    } catch {
      /* ignore */
    }
  }

  const handleRateChange = (value: number) => {
    setRate(value)
    try {
      localStorage.setItem(RATE_KEY, String(value))
    } catch {
      /* ignore */
    }
  }

  const handlePitchChange = (value: number) => {
    setPitch(value)
    try {
      localStorage.setItem(PITCH_KEY, String(value))
    } catch {
      /* ignore */
    }
  }

  const handleMultiVoiceToggle = (value: boolean) => {
    setMultiVoice(value)
    try {
      localStorage.setItem(MULTI_VOICE_KEY, value ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  const handleEngineChange = (value: Engine) => {
    setEngine(value)
    try {
      localStorage.setItem(ENGINE_KEY, value)
    } catch {
      /* ignore */
    }
  }

  const handleOpenaiVoiceChange = (value: string) => {
    if (!isOpenAiVoiceId(value)) return
    setOpenaiVoiceId(value)
    try {
      localStorage.setItem(OPENAI_VOICE_KEY, value)
    } catch {
      /* ignore */
    }
  }

  const handlePlayToggle = () => {
    if (player.playState === 'playing') {
      player.pause()
      return
    }
    if (player.playState === 'paused') {
      player.resume()
      return
    }
    const text = editorRef.current?.getValue() ?? ''
    if (!text.trim()) return
    setPlaybackSnapshot(text)
    player.play(text)
  }

  const handleStop = () => player.stop()

  const handleSeek = (deltaSeconds: number) => {
    if (!playbackSnapshot) return
    player.seek(deltaSeconds, playbackSnapshot)
  }

  const fractionFromPointerX = (clientX: number) => {
    const bar = scrubBarRef.current
    if (!bar) return 0
    const rect = bar.getBoundingClientRect()
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
  }

  const handleScrubPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (player.chunks.length === 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragFraction(fractionFromPointerX(e.clientX))
  }

  const handleScrubPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragFraction === null) return
    setDragFraction(fractionFromPointerX(e.clientX))
  }

  const handleScrubPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragFraction === null || !playbackSnapshot) return
    const fraction = fractionFromPointerX(e.clientX)
    setDragFraction(null)
    player.seekToFraction(fraction, playbackSnapshot)
  }

  const handleReplay = () => {
    const text = editorRef.current?.getValue() ?? ''
    if (!text.trim()) return
    setPlaybackSnapshot(text)
    player.replay(text)
  }

  const handleClear = () => {
    player.stop()
    editorRef.current?.setValue('')
  }

  const handlePasteFromClipboard = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText()
      if (!clipboardText) return
      const current = editorRef.current?.getValue() ?? ''
      const merged = current ? `${current}\n${clipboardText}` : clipboardText
      editorRef.current?.setValue(merged)
      if (player.playState !== 'idle') handleEditWhilePlaying()
    } catch {
      setCopyNotice('ไม่สามารถอ่านคลิปบอร์ดได้ กรุณาวางข้อความด้วย Ctrl+V / Cmd+V แทน')
    }
  }

  const handleDownloadAudio = async () => {
    const text = editorRef.current?.getValue() ?? ''
    if (!text.trim()) return
    setPlaybackSnapshot(text)
    await recorder.start(
      () => {
        player.play(text, { onComplete: () => recorder.stop() })
      },
      (blob) => {
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `tts-${Date.now()}.webm`
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
        setTimeout(() => URL.revokeObjectURL(url), 5000)
      },
    )
  }

  const highlight =
    player.currentIndex >= 0 && player.chunks[player.currentIndex]
      ? { start: player.chunks[player.currentIndex].start, end: player.chunks[player.currentIndex].end }
      : null

  const displayFraction = dragFraction ?? liveFraction
  const progressPercent = Math.round(displayFraction * 100)

  if (!speechSupported) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-center dark:bg-slate-950">
        <div className="max-w-md rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          <AlertTriangle className="mx-auto mb-3" size={28} />
          <p className="font-medium">เบราว์เซอร์นี้ไม่รองรับ Web Speech API</p>
          <p className="mt-2 text-sm">กรุณาเปิดเว็บนี้ด้วย Chrome, Edge หรือ Safari เวอร์ชันล่าสุดแทน</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-white text-slate-900 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950 dark:text-slate-100">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500 text-white shadow-sm">
              <Volume2 size={20} />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">อ่านออกเสียง</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Text to Speech ฟรี ไม่ต้องมี API key</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDarkMode((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="สลับธีมสว่าง/มืด"
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>

        {engine === 'browser' && thaiMissing && <ThaiVoiceHelp />}

        <section className="flex flex-col gap-3">
          <TabBar
            tabs={tabState.tabs}
            activeTabId={tabState.activeTabId}
            onSelect={handleSelectTab}
            onAdd={handleAddTab}
            onRename={handleRenameTab}
            onClose={handleCloseTab}
          />

          <TextEditor
            key={tabState.activeTabId}
            ref={editorRef}
            initialValue={activeTab.text}
            onEditWhilePlaying={handleEditWhilePlaying}
            onDebouncedChange={handleDebouncedChange}
            isPlaying={player.playState !== 'idle' || player.isBuffering}
            highlight={highlight}
            snapshotText={playbackSnapshot}
            placeholder="พิมพ์หรือวางข้อความที่ต้องการให้อ่านออกเสียงที่นี่..."
          />

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500 dark:text-slate-400">
            <span>
              {charCount.toLocaleString('th-TH')} ตัวอักษร · {wordCount.toLocaleString('th-TH')} คำ
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePasteFromClipboard}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Clipboard size={14} /> วางจากคลิปบอร์ด
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Trash2 size={14} /> ล้างข้อความ
              </button>
            </div>
          </div>

          {editedNotice && (
            <div className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
              แก้ไขข้อความแล้ว กดเล่นใหม่อีกครั้ง
            </div>
          )}
          {copyNotice && (
            <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {copyNotice}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 text-sm font-medium dark:bg-slate-800">
            <button
              type="button"
              onClick={() => handleEngineChange('browser')}
              className={`rounded-lg px-3 py-1.5 transition ${
                engine === 'browser'
                  ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              เสียงฟรี (เครื่อง)
            </button>
            <button
              type="button"
              onClick={() => handleEngineChange('openai')}
              className={`flex items-center justify-center gap-1 rounded-lg px-3 py-1.5 transition ${
                engine === 'openai'
                  ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Sparkles size={14} /> เสียง AI (OpenAI)
            </button>
          </div>

          {engine === 'browser' ? (
            <>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300" htmlFor="voice-select">
                  เสียงพูด
                </label>
                <select
                  id="voice-select"
                  value={selectedVoiceURI ?? ''}
                  onChange={(e) => handleVoiceChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  {voices.length === 0 && <option value="">กำลังโหลดรายการเสียง...</option>}
                  {voiceGroups.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.voices.map((voice) => (
                        <option key={voice.voiceURI} value={voice.voiceURI}>
                          {voice.name} ({voice.lang})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <label className="flex items-center justify-between gap-3 text-sm">
                <span className="flex flex-col">
                  <span className="font-medium text-slate-600 dark:text-slate-300">สลับเสียงตามภาษาอัตโนมัติ</span>
                  <span className="text-xs text-slate-400">เหมาะกับข้อความที่มีไทย-อังกฤษปนกัน (อาจเล่นช้าลงเล็กน้อย)</span>
                </span>
                <input
                  type="checkbox"
                  checked={multiVoice}
                  onChange={(e) => handleMultiVoiceToggle(e.target.checked)}
                  className="h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-slate-300 transition before:block before:h-5 before:w-5 before:translate-x-0 before:rounded-full before:bg-white before:shadow before:transition checked:bg-sky-500 checked:before:translate-x-4 dark:bg-slate-700"
                />
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <RangeSlider label="ความเร็ว" value={rate} min={0.5} max={2} step={0.1} onChange={handleRateChange} />
                <RangeSlider
                  label="ระดับเสียงสูงต่ำ"
                  value={pitch}
                  min={0}
                  max={2}
                  step={0.1}
                  onChange={handlePitchChange}
                  suffix=""
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300" htmlFor="openai-voice-select">
                  เสียง AI (OpenAI)
                </label>
                <select
                  id="openai-voice-select"
                  value={openaiVoiceId}
                  onChange={(e) => handleOpenaiVoiceChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  {OPENAI_VOICES.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.label}
                    </option>
                  ))}
                </select>
              </div>

              <RangeSlider label="ความเร็ว" value={rate} min={0.5} max={2} step={0.1} onChange={handleRateChange} />

              <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
                เสียง AI ฟังดูเป็นธรรมชาติกว่าและอ่านไทย-อังกฤษปนกันได้ในเสียงเดียว แต่มีค่าใช้จ่ายตามการใช้งาน
                (ประมาณ $15 ต่อล้านตัวอักษร) และต้องรันเซิร์ฟเวอร์เสริมก่อนด้วยคำสั่ง{' '}
                <code className="rounded bg-sky-100 px-1 py-0.5 font-mono dark:bg-sky-900">npm run server</code>{' '}
                (ตั้งค่า API key ใน <code className="rounded bg-sky-100 px-1 py-0.5 font-mono dark:bg-sky-900">server/.env</code>{' '}
                ก่อน)
              </p>

              {player.error && (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
                  {player.error}
                </div>
              )}
            </>
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => handleSeek(-15)}
              disabled={player.playState === 'idle'}
              title="ย้อนกลับ 15 วินาที"
              className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Rewind size={16} /> 15 วิ
            </button>
            <button
              type="button"
              onClick={() => handleSeek(-5)}
              disabled={player.playState === 'idle'}
              title="ย้อนกลับ 5 วินาที"
              className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Rewind size={14} /> 5 วิ
            </button>
            <button
              type="button"
              onClick={handlePlayToggle}
              className="flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 font-medium text-white shadow-sm transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={(!debouncedText.trim() && player.playState === 'idle') || player.isBuffering}
            >
              {player.isBuffering ? (
                <Loader2 size={18} className="animate-spin" />
              ) : player.playState === 'playing' ? (
                <Pause size={18} />
              ) : (
                <Play size={18} />
              )}
              {player.isBuffering
                ? 'กำลังโหลดเสียง...'
                : player.playState === 'playing'
                  ? 'หยุดชั่วคราว'
                  : player.playState === 'paused'
                    ? 'เล่นต่อ'
                    : 'เล่น'}
            </button>
            <button
              type="button"
              onClick={() => handleSeek(5)}
              disabled={player.playState === 'idle'}
              title="เดินหน้า 5 วินาที"
              className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              5 วิ <FastForward size={14} />
            </button>
            <button
              type="button"
              onClick={() => handleSeek(15)}
              disabled={player.playState === 'idle'}
              title="เดินหน้า 15 วินาที"
              className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              15 วิ <FastForward size={16} />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleStop}
              disabled={player.playState === 'idle'}
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Square size={16} /> หยุด
            </button>
            <button
              type="button"
              onClick={handleReplay}
              disabled={!debouncedText.trim()}
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <RotateCcw size={16} /> เล่นใหม่
            </button>
            <button
              type="button"
              onClick={handleDownloadAudio}
              disabled={recorder.isRecording || !debouncedText.trim()}
              className="ml-auto flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {recorder.isRecording ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              {recorder.isRecording ? 'กำลังอัดเสียง...' : 'ดาวน์โหลดไฟล์เสียง'}
            </button>
          </div>

          {player.chunks.length > 0 && (player.playState !== 'idle' || player.isBuffering) && (
            <div className="flex flex-col gap-1.5">
              <div
                ref={scrubBarRef}
                role="slider"
                aria-label="ตำแหน่งการอ่านออกเสียง"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressPercent}
                onPointerDown={handleScrubPointerDown}
                onPointerMove={handleScrubPointerMove}
                onPointerUp={handleScrubPointerUp}
                onPointerCancel={handleScrubPointerUp}
                className="group relative flex h-5 w-full touch-none items-center"
              >
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className={`h-full rounded-full bg-sky-500 ${dragFraction === null ? 'transition-[width] duration-150' : ''}`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div
                  className="absolute h-4 w-4 -translate-x-1/2 cursor-grab rounded-full bg-sky-500 shadow ring-2 ring-white active:cursor-grabbing active:scale-125 dark:ring-slate-900"
                  style={{ left: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                กำลังอ่านชิ้นที่ {Math.min(player.currentIndex + 1, player.chunks.length)} จาก {player.chunks.length} ·
                แตะหรือลากแถบเพื่อข้ามไปตำแหน่งที่ต้องการ
              </span>
            </div>
          )}

          {recorder.error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {recorder.error}
            </div>
          )}
          {!recorder.isSupported && (
            <p className="text-xs text-slate-400">
              การดาวน์โหลดไฟล์เสียงต้องเลือกแชร์เสียงแท็บนี้ผ่านหน้าต่างของเบราว์เซอร์ รองรับเฉพาะ Chrome/Edge บนคอมพิวเตอร์
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
