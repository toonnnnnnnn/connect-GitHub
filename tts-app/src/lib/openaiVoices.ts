export const OPENAI_VOICES = [
  { id: 'alloy', label: 'Alloy' },
  { id: 'ash', label: 'Ash' },
  { id: 'ballad', label: 'Ballad' },
  { id: 'coral', label: 'Coral' },
  { id: 'echo', label: 'Echo' },
  { id: 'fable', label: 'Fable' },
  { id: 'nova', label: 'Nova' },
  { id: 'onyx', label: 'Onyx' },
  { id: 'sage', label: 'Sage' },
  { id: 'shimmer', label: 'Shimmer' },
  { id: 'verse', label: 'Verse' },
] as const

export type OpenAiVoiceId = (typeof OPENAI_VOICES)[number]['id']

export const DEFAULT_OPENAI_VOICE: OpenAiVoiceId = 'alloy'

export function isOpenAiVoiceId(value: string): value is OpenAiVoiceId {
  return OPENAI_VOICES.some((v) => v.id === value)
}
