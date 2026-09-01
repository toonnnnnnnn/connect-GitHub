import { AlertTriangle } from 'lucide-react'

const INSTRUCTIONS: { platform: string; steps: string }[] = [
  { platform: 'Windows', steps: 'Settings → Time & Language → Language & region → เพิ่มภาษา "ไทย" → เปิดตัวเลือก Speech เพื่อติดตั้งเสียงพูด' },
  { platform: 'macOS', steps: 'System Settings → Accessibility → Spoken Content → System voice → Manage Voices… → ติ๊กเลือกเสียงภาษาไทย' },
  { platform: 'Android', steps: 'ตั้งค่า → ระบบ → ภาษาและอินพุต → เอาต์พุตแปลงข้อความเป็นเสียงพูด → ติดตั้งข้อมูลเสียงภาษาไทย' },
  { platform: 'iOS / iPadOS', steps: 'Settings → Accessibility → Spoken Content → Voices → เลือก Thai แล้วดาวน์โหลดเสียง' },
]

export function ThaiVoiceHelp() {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
      <div className="flex items-center gap-2 font-medium">
        <AlertTriangle size={18} className="shrink-0" />
        <span>ไม่พบเสียงพูดภาษาไทยในเครื่องนี้</span>
      </div>
      <p>ยังใช้งานแอปได้ตามปกติ แต่จะได้ยินเสียงอ่านเป็นภาษาอังกฤษแทน ลองติดตั้งเสียงไทยเพิ่มเติมได้ตามนี้:</p>
      <ul className="flex flex-col gap-1.5">
        {INSTRUCTIONS.map((item) => (
          <li key={item.platform}>
            <span className="font-semibold">{item.platform}:</span> {item.steps}
          </li>
        ))}
      </ul>
    </div>
  )
}
