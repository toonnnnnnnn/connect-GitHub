interface RangeSliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  suffix?: string
}

export function RangeSlider({ label, value, min, max, step, onChange, suffix = 'x' }: RangeSliderProps) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="flex items-center justify-between font-medium text-slate-600 dark:text-slate-300">
        <span>{label}</span>
        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {value.toFixed(1)}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-sky-500 dark:bg-slate-700"
      />
    </label>
  )
}
