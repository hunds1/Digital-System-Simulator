import type { InputHTMLAttributes } from 'react'
import { useMemo } from 'react'
import { cn } from '../../utils/cn'

interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  showTooltip?: boolean
}

export const Slider = ({ className, min = 0, max = 100, value = 0, showTooltip = true, ...props }: SliderProps) => {
  const percent = useMemo(() => {
    const current = Number(value)
    const minValue = Number(min)
    const maxValue = Number(max)
    if (maxValue <= minValue) return 0
    return ((current - minValue) / (maxValue - minValue)) * 100
  }, [value, min, max])

  return (
    <div className="relative pt-6">
      {showTooltip && (
        <div
          className="absolute -top-0.5 -translate-x-1/2 rounded-md bg-surface-700 px-2 py-1 font-mono text-xs text-slate-100"
          style={{ left: `${percent}%` }}
        >
          {value}
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        className={cn(
          'h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-700',
          '[&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-surface-700',
          '[&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary-500',
          className,
        )}
        style={{
          background: `linear-gradient(to right, #3b82f6 ${percent}%, #334155 ${percent}%)`,
        }}
        {...props}
      />
    </div>
  )
}
