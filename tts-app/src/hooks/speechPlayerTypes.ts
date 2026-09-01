import type { TextChunk } from '../lib/textChunking'

export type PlayState = 'idle' | 'playing' | 'paused'

export interface PlayArgs {
  onComplete?: () => void
}

/** Common shape both the free browser-voice player and the OpenAI AI-voice
 * player implement, so App.tsx can swap between them without branching every
 * call site. */
export interface SpeechPlayerController {
  playState: PlayState
  chunks: TextChunk[]
  currentIndex: number
  /** True while fetching audio for the next chunk (always false for the
   * browser engine, which has no network round-trip). */
  isBuffering: boolean
  /** Last playback error, if any (always null for the browser engine). */
  error: string | null
  play: (text: string, args?: PlayArgs) => void
  pause: () => void
  resume: () => void
  stop: () => void
  replay: (text: string) => void
  seek: (deltaSeconds: number, fullText: string) => void
  seekToFraction: (fraction: number, fullText: string) => void
  getProgressFraction: (fullText: string) => number
}
