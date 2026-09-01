// Chrome's SpeechSynthesis hard-limits a single utterance to ~32,767 chars,
// and Thai text has no whitespace between sentences, so we split well below
// that ceiling and try to cut on sentence boundaries / whitespace first.
const TARGET_CHUNK_CHARS = 240
const HARD_MAX_CHUNK_CHARS = 300
const SENTENCE_ENDERS = new Set(['.', '!', '?', '\n'])

export interface TextChunk {
  text: string
  start: number
  end: number
}

export function hasThai(text: string): boolean {
  return /[฀-๿]/.test(text)
}

export function hasLatin(text: string): boolean {
  return /[A-Za-z]/.test(text)
}

/**
 * Splits text into TTS-safe chunks, preferring to break at a sentence ender
 * within the target window, falling back to whitespace, then a hard cut.
 */
export function chunkText(text: string): TextChunk[] {
  const chunks: TextChunk[] = []
  const n = text.length
  let i = 0

  while (i < n) {
    const windowEnd = Math.min(i + HARD_MAX_CHUNK_CHARS, n)
    let cut = -1

    for (let j = i; j < windowEnd; j++) {
      if (SENTENCE_ENDERS.has(text[j])) cut = j + 1
    }

    if (cut <= i) {
      if (windowEnd < n) {
        const minCut = i + Math.floor(TARGET_CHUNK_CHARS * 0.5)
        let wsCut = -1
        for (let j = windowEnd; j > minCut; j--) {
          if (/\s/.test(text[j])) {
            wsCut = j + 1
            break
          }
        }
        cut = wsCut !== -1 ? wsCut : windowEnd
      } else {
        cut = windowEnd
      }
    }

    const raw = text.slice(i, cut)
    const trimmed = raw.trim()
    if (trimmed.length > 0) {
      // Keep original offsets so the UI can highlight the exact source range.
      const leading = raw.length - raw.trimStart().length
      chunks.push({ text: trimmed, start: i + leading, end: i + leading + trimmed.length })
    }
    i = cut
  }

  return chunks
}

export function countWords(text: string): number {
  const trimmed = text.trim()
  if (trimmed.length === 0) return 0
  return trimmed.split(/\s+/).length
}
