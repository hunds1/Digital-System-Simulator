import { Database } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { HelpTooltip, Input, Select, Slider } from '../../components/ui'
import { useSettingsStore } from '../../store/settingsStore'

const modeOptions = [
  { value: 'fast', label: 'Fast' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'accurate', label: 'Accurate' },
]

export const SettingsPage = () => {
  const { systemName, calculationMode, intensity, setSystemName, setCalculationMode, setIntensity } = useSettingsStore()

  return (
    <section className="animate-slide-up space-y-4">
      <h2 className="text-2xl font-semibold">Настройки</h2>
      <Card className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 text-sm text-slate-300">
            <span>Название системы</span>
            <HelpTooltip text="Произвольное имя системы, которое сохраняется в настройках и может быть использовано в отчетах." />
          </div>
          <Input
            label="Название системы"
            placeholder="System-01"
            leftIcon={Database}
            value={systemName}
            onChange={(event) => setSystemName(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 text-sm text-slate-300">
            <span>Режим расчета</span>
            <HelpTooltip text="Выбираемый режим расчета влияет на скорость и точность анализа системы." />
          </div>
          <Select value={calculationMode} onChange={(value) => setCalculationMode(value as 'fast' | 'balanced' | 'accurate')} options={modeOptions} searchable />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 text-sm text-slate-300">
            <span>Интенсивность</span>
            <HelpTooltip text="Интенсивность нагрузки системы. Чем выше значение, тем более серьёзная нагрузка." />
          </div>
          <Slider value={intensity} onChange={(event) => setIntensity(Number(event.target.value))} />
        </div>
      </Card>
    </section>
  )
}
