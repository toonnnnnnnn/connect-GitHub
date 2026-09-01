import { useCallback, useEffect, useRef, useState } from 'react'
import { chunkText, type TextChunk } from '../lib/textChunking'
import type { PlayArgs, PlayState, SpeechPlayerController } from './speechPlayerTypes'

interface AiSpeechPlayerOptions {
  apiBaseUrl: string
  voice: string
  speed: number
}

// Fallback estimate used only before a chunk's real audio duration is known
// (e.g. right when a seek lands on a not-yet-fetched chunk).
const FALLBACK_CHARS_PER_SECOND = 14

export function useAiSpeechPlayer(options: AiSpeechPlayerOptions): SpeechPlayerController {
  const [playState, setPlayState] = useState<PlayState>('idle')
  const [chunks, setChunks] = useState<TextChunk[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [isBuffering, setIsBuffering] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const optionsRef = useRef(options)
  optionsRef.current = options

  const playStateRef = useRef<PlayState>('idle')
  const setPlayStateBoth = useCallback((next: PlayState) => {
    playStateRef.current = next
    setPlayState(next)
  }, [])

  const generationRef = useRef(0)
  const onCompleteRef = useRef<(() => void) | null>(null)
  const chunksRef = useRef<TextChunk[]>([])
  const currentIndexRef = useRef(-1)
  const chunkStartOffsetRef = useRef(0)

  // Caches fetched audio by chunk text so re-fetching the same sentence
  // (replay, seeking back) doesn't cost another OpenAI API call.
  const audioCacheRef = useRef<Map<string, string>>(new Map())
  const audioRef = useRef<HTMLAudioElement | null>(null)
  if (audioRef.current === null && typeof Audio !== 'undefined') {
    audioRef.current = new Audio()
  }

  const fetchChunkAudio = useCallback(async (text: string) => {
    const cached = audioCacheRef.current.get(text)
    if (cached) return cached

    const res = await fetch(`${optionsRef.current.apiBaseUrl}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: optionsRef.current.voice, speed: optionsRef.current.speed }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}) as { error?: string })
      throw new Error(body.error || `เรียกเสียง AI ไม่สำเร็จ (HTTP ${res.status})`)
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    audioCacheRef.current.set(text, url)
    return url
  }, [])

  const finish = useCallback(() => {
    setIsBuffering(false)
    setPlayStateBoth('idle')
    setCurrentIndex(-1)
    currentIndexRef.current = -1
    const callback = onCompleteRef.current
    onCompleteRef.current = null
    callback?.()
  }, [setPlayStateBoth])

  const playChunkAt = useCallback(
    (chunkList: TextChunk[], index: number, generation: number) => {
      if (generation !== generationRef.current) return
      if (index >= chunkList.length) {
        finish()
        return
      }

      const chunk = chunkList[index]
      setCurrentIndex(index)
      currentIndexRef.current = index
      chunkStartOffsetRef.current = chunk.start
      setIsBuffering(true)
      setError(null)

      fetchChunkAudio(chunk.text)
        .then((url) => {
          if (generation !== generationRef.current) return
          const audio = audioRef.current
          if (!audio) return

          audio.src = url
          audio.playbackRate = 1
          audio.onended = () => {
            if (generation !== generationRef.current) return
            playChunkAt(chunkList, index + 1, generation)
          }
          audio.onerror = () => {
            if (generation !== generationRef.current) return
            setError('เล่นเสียงที่ได้จาก OpenAI ไม่สำเร็จ ข้ามไปชิ้นถัดไป')
            playChunkAt(chunkList, index + 1, generation)
          }

          return audio.play().then(() => {
            if (generation !== generationRef.current) return
            setIsBuffering(false)
            setPlayStateBoth('playing')
          })
        })
        .catch((err: unknown) => {
          if (generation !== generationRef.current) return
          setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเรียกเสียง AI')
          setIsBuffering(false)
          setPlayStateBoth('idle')
          setCurrentIndex(-1)
          currentIndexRef.current = -1
        })
    },
    [fetchChunkAudio, finish, setPlayStateBoth],
  )

  const play = useCallback(
    (text: string, args?: PlayArgs) => {
      generationRef.current += 1
      const generation = generationRef.current
      onCompleteRef.current = args?.onComplete ?? null
      audioRef.current?.pause()

      const newChunks = chunkText(text)
      setChunks(newChunks)
      chunksRef.current = newChunks
      if (newChunks.length === 0) {
        finish()
        return
      }
      playChunkAt(newChunks, 0, generation)
    },
    [finish, playChunkAt],
  )

  const pause = useCallback(() => {
    if (playStateRef.current !== 'playing') return
    audioRef.current?.pause()
    setPlayStateBoth('paused')
  }, [setPlayStateBoth])

  const resume = useCallback(() => {
    if (playStateRef.current !== 'paused') return
    audioRef.current?.play().catch(() => {})
    setPlayStateBoth('playing')
  }, [setPlayStateBoth])

  const stop = useCallback(() => {
    generationRef.current += 1
    onCompleteRef.current = null
    const audio = audioRef.current
    if (audio) {
      audio.onended = null
      audio.onerror = null
      audio.pause()
      audio.currentTime = 0
    }
    setIsBuffering(false)
    setPlayStateBoth('idle')
    setCurrentIndex(-1)
    currentIndexRef.current = -1
  }, [setPlayStateBoth])

  const replay = useCallback(
    (text: string) => {
      stop()
      play(text)
    },
    [play, stop],
  )

  /** Estimates the character offset speech is currently at. Once a chunk's
   * real audio has loaded, its actual duration gives a precise chars/sec for
   * that chunk; otherwise falls back to a rough constant-rate estimate. */
  const estimateCurrentOffset = useCallback(() => {
    const audio = audioRef.current
    const fallbackCharsPerSec = FALLBACK_CHARS_PER_SECOND * optionsRef.current.speed

    if (audio && Number.isFinite(audio.duration) && audio.duration > 0) {
      const chunk = chunksRef.current[currentIndexRef.current]
      if (chunk) {
        const realCharsPerSec = chunk.text.length / audio.duration
        return chunk.start + audio.currentTime * realCharsPerSec
      }
    }
    return chunkStartOffsetRef.current + (audio?.currentTime ?? 0) * fallbackCharsPerSec
  }, [])

  const seekToOffset = useCallback(
    (targetOffsetRaw: number, fullText: string) => {
      const targetOffset = Math.min(fullText.length, Math.max(0, targetOffsetRaw))
      generationRef.current += 1
      const generation = generationRef.current
      audioRef.current?.pause()

      if (targetOffset >= fullText.length) {
        finish()
        return
      }

      const remaining = chunkText(fullText.slice(targetOffset)).map((c) => ({
        text: c.text,
        start: c.start + targetOffset,
        end: c.end + targetOffset,
      }))

      if (remaining.length === 0) {
        finish()
        return
      }

      setChunks(remaining)
      chunksRef.current = remaining
      playChunkAt(remaining, 0, generation)
    },
    [finish, playChunkAt],
  )

  const seek = useCallback(
    (deltaSeconds: number, fullText: string) => {
      if (playStateRef.current === 'idle') return
      const charsPerSec = FALLBACK_CHARS_PER_SECOND * optionsRef.current.speed
      seekToOffset(estimateCurrentOffset() + deltaSeconds * charsPerSec, fullText)
    },
    [estimateCurrentOffset, seekToOffset],
  )

  const seekToFraction = useCallback(
    (fraction: number, fullText: string) => {
      if (fullText.length === 0) return
      const clamped = Math.min(1, Math.max(0, fraction))
      seekToOffset(Math.round(clamped * fullText.length), fullText)
    },
    [seekToOffset],
  )

  const getProgressFraction = useCallback(
    (fullText: string) => {
      if (playStateRef.current === 'idle' || fullText.length === 0) return 0
      return Math.min(1, Math.max(0, estimateCurrentOffset() / fullText.length))
    },
    [estimateCurrentOffset],
  )

  useEffect(() => {
    return () => {
      generationRef.current += 1
      const audio = audioRef.current
      if (audio) {
        audio.onended = null
        audio.onerror = null
        audio.pause()
      }
      audioCacheRef.current.forEach((url) => URL.revokeObjectURL(url))
      audioCacheRef.current.clear()
    }
  }, [])

  return {
    playState,
    chunks,
    currentIndex,
    isBuffering,
    error,
    play,
    pause,
    resume,
    stop,
    replay,
    seek,
    seekToFraction,
    getProgressFraction,
  }
}
