import { useEffect, useState } from 'react'

export function useVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() =>
    typeof window !== 'undefined' && 'speechSynthesis' in window
      ? window.speechSynthesis.getVoices()
      : [],
  )

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

    const update = () => setVoices(window.speechSynthesis.getVoices())
    update()

    window.speechSynthesis.addEventListener('voiceschanged', update)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', update)
  }, [])

  return voices
}
