import { useCallback, useRef, useState } from 'react'

const UNSUPPORTED_MESSAGE = 'ฟีเจอร์ดาวน์โหลดไฟล์เสียงรองรับเฉพาะ Chrome/Edge บนคอมพิวเตอร์เท่านั้น'

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)

  const isSupported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getDisplayMedia &&
    typeof MediaRecorder !== 'undefined'

  const start = useCallback(
    async (onReady: () => void, onFinished: (blob: Blob) => void) => {
      setError(null)
      if (!isSupported) {
        setError(UNSUPPORTED_MESSAGE)
        return
      }

      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
        const audioTracks = displayStream.getAudioTracks()
        displayStream.getVideoTracks().forEach((t) => t.stop())

        if (audioTracks.length === 0) {
          displayStream.getTracks().forEach((t) => t.stop())
          setError(
            'ไม่พบเสียงที่แชร์ กรุณาลองใหม่ และติ๊กเลือก "แชร์เสียงแท็บนี้ / Share tab audio" ในหน้าต่างที่เบราว์เซอร์เปิดขึ้นมา',
          )
          return
        }

        const audioStream = new MediaStream(audioTracks)
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm'
        const recorder = new MediaRecorder(audioStream, { mimeType })
        const parts: BlobPart[] = []

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) parts.push(event.data)
        }
        recorder.onstop = () => {
          const blob = new Blob(parts, { type: mimeType })
          onFinished(blob)
          audioStream.getTracks().forEach((t) => t.stop())
        }

        recorder.start()
        recorderRef.current = recorder
        setIsRecording(true)
        onReady()
      } catch {
        setError('ไม่สามารถเริ่มอัดเสียงได้ อาจเกิดจากการยกเลิกหน้าต่างเลือกแท็บ หรือเบราว์เซอร์ไม่รองรับฟีเจอร์นี้')
      }
    },
    [isSupported],
  )

  const stop = useCallback(() => {
    recorderRef.current?.stop()
    recorderRef.current = null
    setIsRecording(false)
  }, [])

  return { isRecording, error, isSupported, start, stop }
}
