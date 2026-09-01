import { useEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'

export interface DocTab {
  id: string
  name: string
  text: string
}

interface TabBarProps {
  tabs: DocTab[]
  activeTabId: string
  onSelect: (id: string) => void
  onAdd: () => void
  onRename: (id: string, name: string) => void
  onClose: (id: string) => void
}

export function TabBar({ tabs, activeTabId, onSelect, onAdd, onRename, onClose }: TabBarProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId) inputRef.current?.select()
  }, [editingId])

  const startEditing = (tab: DocTab) => {
    setEditingId(tab.id)
    setDraftName(tab.name)
  }

  const commitEditing = () => {
    if (editingId) onRename(editingId, draftName)
    setEditingId(null)
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId
        return (
          <div
            key={tab.id}
            className={`group flex shrink-0 items-center gap-1 rounded-lg py-1.5 pl-3 pr-1.5 text-sm font-medium transition ${
              isActive
                ? 'bg-sky-500 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {editingId === tab.id ? (
              <input
                ref={inputRef}
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={commitEditing}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEditing()
                  if (e.key === 'Escape') setEditingId(null)
                }}
                className="w-24 rounded bg-white/20 px-1 text-inherit outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => onSelect(tab.id)}
                onDoubleClick={() => startEditing(tab)}
                title="ดับเบิลคลิกเพื่อเปลี่ยนชื่อ"
                className="max-w-[10rem] truncate"
              >
                {tab.name}
              </button>
            )}
            {tabs.length > 1 && (
              <button
                type="button"
                onClick={() => onClose(tab.id)}
                aria-label={`ปิด ${tab.name}`}
                title="ปิดแท็บนี้"
                className={`rounded-full p-0.5 opacity-0 transition group-hover:opacity-100 ${
                  isActive ? 'hover:bg-white/20' : 'hover:bg-slate-300 dark:hover:bg-slate-600'
                }`}
              >
                <X size={12} />
              </button>
            )}
          </div>
        )
      })}
      <button
        type="button"
        onClick={onAdd}
        aria-label="เพิ่มแท็บใหม่"
        title="เพิ่มแท็บใหม่"
        className="flex shrink-0 items-center justify-center rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
      >
        <Plus size={16} />
      </button>
    </div>
  )
}
