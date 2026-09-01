import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

export interface TextEditorHandle {
  getValue: () => string
  setValue: (value: string) => void
  focus: () => void
}

interface HighlightRange {
  start: number
  end: number
}

interface TextEditorProps {
  initialValue: string
  onEditWhilePlaying: () => void
  onDebouncedChange: (value: string) => void
  isPlaying: boolean
  highlight: HighlightRange | null
  snapshotText: string
  placeholder: string
}

// Both layers must share this exact box model or the highlight overlay drifts
// out of alignment with the real glyphs rendered by the textarea on top.
const SHARED_BOX_STYLE: React.CSSProperties = {
  fontFamily: "'Sarabun', 'Noto Sans Thai', system-ui, sans-serif",
  fontSize: '17px',
  lineHeight: '1.8',
  letterSpacing: '0.01em',
  padding: '16px',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  boxSizing: 'border-box',
  // Keeps wrapping width identical whether or not a scrollbar is showing,
  // so the highlight overlay never drifts from the real text underneath.
  scrollbarGutter: 'stable',
}

export const TextEditor = forwardRef<TextEditorHandle, TextEditorProps>(function TextEditor(
  { initialValue, onEditWhilePlaying, onDebouncedChange, isPlaying, highlight, snapshotText, placeholder },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const debounceTimer = useRef<number | null>(null)

  useImperativeHandle(ref, () => ({
    getValue: () => textareaRef.current?.value ?? '',
    setValue: (value: string) => {
      if (textareaRef.current) textareaRef.current.value = value
      onDebouncedChange(value)
    },
    focus: () => textareaRef.current?.focus(),
  }))

  const handleInput = () => {
    if (isPlaying) onEditWhilePlaying()

    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = window.setTimeout(() => {
      onDebouncedChange(textareaRef.current?.value ?? '')
    }, 300)
  }

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [])

  const handleScroll = () => {
    if (backdropRef.current && textareaRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop
      backdropRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }

  const before = highlight ? snapshotText.slice(0, highlight.start) : ''
  const active = highlight ? snapshotText.slice(highlight.start, highlight.end) : ''
  const after = highlight ? snapshotText.slice(highlight.end) : ''

  return (
    <div className="relative w-full">
      {highlight && (
        <div
          ref={backdropRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl border border-transparent text-transparent"
          style={SHARED_BOX_STYLE}
        >
          <span>{before}</span>
          <mark className="rounded bg-sky-300/60 text-transparent dark:bg-sky-400/40">{active}</mark>
          <span>{after}</span>
        </div>
      )}
      <textarea
        ref={textareaRef}
        defaultValue={initialValue}
        onInput={handleInput}
        onScroll={handleScroll}
        placeholder={placeholder}
        spellCheck={false}
        className="relative z-10 w-full resize-y rounded-2xl border border-slate-200 bg-white/70 text-slate-800 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100 dark:focus:border-sky-500 dark:focus:ring-sky-900"
        style={{ ...SHARED_BOX_STYLE, minHeight: '260px', background: highlight ? 'transparent' : undefined }}
      />
    </div>
  )
})
