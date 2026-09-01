export interface VoiceGroup {
  label: string
  voices: SpeechSynthesisVoice[]
}

export function groupVoices(voices: SpeechSynthesisVoice[]): VoiceGroup[] {
  const thai: SpeechSynthesisVoice[] = []
  const english: SpeechSynthesisVoice[] = []
  const others: SpeechSynthesisVoice[] = []

  for (const voice of voices) {
    const lang = voice.lang.toLowerCase()
    if (lang.startsWith('th')) thai.push(voice)
    else if (lang.startsWith('en')) english.push(voice)
    else others.push(voice)
  }

  const groups: VoiceGroup[] = []
  if (thai.length) groups.push({ label: 'ภาษาไทย', voices: thai })
  if (english.length) groups.push({ label: 'ภาษาอังกฤษ', voices: english })
  if (others.length) groups.push({ label: 'ภาษาอื่นๆ', voices: others })
  return groups
}

export function hasThaiVoice(voices: SpeechSynthesisVoice[]): boolean {
  return voices.some((v) => v.lang.toLowerCase().startsWith('th'))
}

export function findVoiceByURI(
  voices: SpeechSynthesisVoice[],
  uri: string | null,
): SpeechSynthesisVoice | undefined {
  if (!uri) return undefined
  return voices.find((v) => v.voiceURI === uri)
}

/** Picks the best voice for a language, preferring the currently-selected
 * voice when it already matches, otherwise the first voice of that language. */
export function pickVoiceForLanguage(
  voices: SpeechSynthesisVoice[],
  isThai: boolean,
  preferred: SpeechSynthesisVoice | undefined,
): SpeechSynthesisVoice | undefined {
  const prefix = isThai ? 'th' : 'en'
  if (preferred && preferred.lang.toLowerCase().startsWith(prefix)) return preferred
  const match = voices.find((v) => v.lang.toLowerCase().startsWith(prefix))
  return match ?? preferred ?? voices[0]
}
