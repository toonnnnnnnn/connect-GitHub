import { useCallback, useEffect, useRef, useState } from 'react'
import { chunkText, hasThai, type TextChunk } from '../lib/textChunking'
import { pickVoiceForLanguage } from '../lib/voices'
import type { PlayArgs, PlayState, SpeechPlayerController } from './speechPlayerTypes'

interface SpeechPlayerOptions {
  voices: SpeechSynthesisVoice[]
  selectedVoice: SpeechSynthesisVoice | undefined
  rate: number
  pitch: number
  multiVoice: boolean
}

// Chrome silently stops firing utterance events if speechSynthesis stays busy
// for too long without a pause/resume nudge — this keeps long readings alive.
const KEEP_ALIVE_MS = 10000

// Web Speech API has no seek/scrub API, so "skip 5s / 15s" is approximated by
// estimating how many characters that many seconds of speech covers, then
// re-chunking and restarting speech from that estimated character offset.
const BASE_CHARS_PER_SECOND = 14

export function useSpeechPlayer(options: SpeechPlayerOptions): SpeechPlayerController {
  const [playState, setPlayState] = useState<PlayState>('idle')
  const [chunks, setChunks] = useState<TextChunk[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)

  const optionsRef = useRef(options)
  optionsRef.current = options

  // Mirrors `playState` synchronously so seek()/pause()/resume() can read the
  // latest value without waiting for a render, and without doing side effects
  // inside a setState updater (unsafe under StrictMode's double-invocation).
  const playStateRef = useRef<PlayState>('idle')
  const setPlayStateBoth = useCallback((next: PlayState) => {
    playStateRef.current = next
    setPlayState(next)
  }, [])

  // Bumped on every play()/stop()/seek() so stale onend/onerror callbacks
  // from a just-cancelled utterance can recognize they're obsolete and no-op.
  const generationRef = useRef(0)
  const keepAliveRef = useRef<number | null>(null)
  const onCompleteRef = useRef<(() => void) | null>(null)

  // Playback-position tracking, used only to estimate the seek target.
  const chunkStartTimeRef = useRef(0)
  const chunkStartOffsetRef = useRef(0)
  const pausedAccumRef = useRef(0)
  const pauseStartRef = useRef<number | null>(null)

  const clearKeepAlive = useCallback(() => {
    if (keepAliveRef.current !== null) {
      clearInterval(keepAliveRef.current)
      keepAliveRef.current = null
    }
  }, [])

  const startKeepAlive = useCallback(() => {
    clearKeepAlive()
    keepAliveRef.current = window.setInterval(() => {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause()
        window.speechSynthesis.resume()
      }
    }, KEEP_ALIVE_MS)
  }, [clearKeepAlive])

  const finish = useCallback(() => {
    clearKeepAlive()
    setPlayStateBoth('idle')
    setCurrentIndex(-1)
    const callback = onCompleteRef.current
    onCompleteRef.current = null
    callback?.()
  }, [clearKeepAlive, setPlayStateBoth])

  const speakFrom = useCallback(
    (chunkList: TextChunk[], index: number, generation: number) => {
      if (generation !== generationRef.current) return
      if (index >= chunkList.length) {
        window.speechSynthesis.cancel()
        finish()
        return
      }

      setCurrentIndex(index)
      const chunk = chunkList[index]
      const utterance = new SpeechSynthesisUtterance(chunk.text)
      const { voices, selectedVoice, rate, pitch, multiVoice } = optionsRef.current
      const voice = multiVoice
        ? pickVoiceForLanguage(voices, hasThai(chunk.text), selectedVoice)
        : selectedVoice

      if (voice) {
        utterance.voice = voice
        utterance.lang = voice.lang
      }
      utterance.rate = rate
      utterance.pitch = pitch

      utterance.onstart = () => {
        if (generation !== generationRef.current) return
        chunkStartTimeRef.current = performance.now()
        chunkStartOffsetRef.current = chunk.start
        pausedAccumRef.current = 0
        pauseStartRef.current = null
      }
      utterance.onend = () => {
        if (generation !== generationRef.current) return
        speakFrom(chunkList, index + 1, generation)
      }
      utterance.onerror = (event) => {
        if (generation !== generationRef.current) return
        if (event.error === 'interrupted' || event.error === 'canceled') return
        speakFrom(chunkList, index + 1, generation)
      }

      window.speechSynthesis.speak(utterance)
    },
    [finish],
  )

  const play = useCallback(
    (text: string, args?: PlayArgs) => {
      generationRef.current += 1
      const generation = generationRef.current
      window.speechSynthesis.cancel()
      onCompleteRef.current = args?.onComplete ?? null

      const newChunks = chunkText(text)
      setChunks(newChunks)
      if (newChunks.length === 0) {
        finish()
        return
      }

      setPlayStateBoth('playing')
      startKeepAlive()
      speakFrom(newChunks, 0, generation)
    },
    [finish, speakFrom, startKeepAlive, setPlayStateBoth],
  )

  const pause = useCallback(() => {
    if (playStateRef.current !== 'playing') return
    window.speechSynthesis.pause()
    pauseStartRef.current = performance.now()
    setPlayStateBoth('paused')
  }, [setPlayStateBoth])

  const resume = useCallback(() => {
    if (playStateRef.current !== 'paused') return
    window.speechSynthesis.resume()
    if (pauseStartRef.current !== null) {
      pausedAccumRef.current += performance.now() - pauseStartRef.current
      pauseStartRef.current = null
    }
    setPlayStateBoth('playing')
  }, [setPlayStateBoth])

  const stop = useCallback(() => {
    generationRef.current += 1
    onCompleteRef.current = null
    window.speechSynthesis.cancel()
    clearKeepAlive()
    setPlayStateBoth('idle')
    setCurrentIndex(-1)
  }, [clearKeepAlive, setPlayStateBoth])

  const replay = useCallback(
    (text: string) => {
      stop()
      window.setTimeout(() => play(text), 60)
    },
    [play, stop],
  )

  /** Jumps playback to an absolute character offset in `fullText` (the exact
   * text the current playback started from) and starts speaking from there. */
  const seekToOffset = useCallback(
    (targetOffsetRaw: number, fullText: string) => {
      const targetOffset = Math.min(fullText.length, Math.max(0, targetOffsetRaw))

      generationRef.current += 1
      const generation = generationRef.current
      window.speechSynthesis.cancel()

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
      setPlayStateBoth('playing')
      startKeepAlive()
      speakFrom(remaining, 0, generation)
    },
    [finish, speakFrom, startKeepAlive, setPlayStateBoth],
  )

  /** Estimates the character offset speech is currently at, based on elapsed
   * time since the current chunk started (Web Speech API exposes no true
   * playback-position API). */
  const estimateCurrentOffset = useCallback(() => {
    const referenceNow = pauseStartRef.current ?? performance.now()
    const elapsedMs = referenceNow - chunkStartTimeRef.current - pausedAccumRef.current
    const elapsedSec = Math.max(0, elapsedMs / 1000)
    const charsPerSec = BASE_CHARS_PER_SECOND * optionsRef.current.rate
    return chunkStartOffsetRef.current + elapsedSec * charsPerSec
  }, [])

  /** Skips playback forward (positive) or backward (negative) by an estimated
   * number of seconds. */
  const seek = useCallback(
    (deltaSeconds: number, fullText: string) => {
      if (playStateRef.current === 'idle') return
      const charsPerSec = BASE_CHARS_PER_SECOND * optionsRef.current.rate
      seekToOffset(estimateCurrentOffset() + deltaSeconds * charsPerSec, fullText)
    },
    [estimateCurrentOffset, seekToOffset],
  )

  /** Jumps playback to a fraction (0–1) of the way through `fullText` —
   * used by a scrubbable progress bar. */
  const seekToFraction = useCallback(
    (fraction: number, fullText: string) => {
      if (fullText.length === 0) return
      const clamped = Math.min(1, Math.max(0, fraction))
      seekToOffset(Math.round(clamped * fullText.length), fullText)
    },
    [seekToOffset],
  )

  /** Estimates how far through `fullText` playback currently is, as a
   * fraction from 0–1 — used to position a scrubbable progress bar. */
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
      window.speechSynthesis.cancel()
      clearKeepAlive()
    }
  }, [clearKeepAlive])

  return {
    playState,
    chunks,
    currentIndex,
    isBuffering: false,
    error: null,
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
