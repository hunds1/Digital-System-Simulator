import { Database } from 'lucide-react'
import { useState } from 'react'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Slider } from '../../components/ui/Slider'

const modeOptions = [
  { value: 'fast', label: 'Fast' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'accurate', label: 'Accurate' },
]

export const SettingsPage = () => {
  const [mode, setMode] = useState('balanced')
  const [intensity, setIntensity] = useState(45)

  return (
    <section className="animate-slide-up space-y-4">
      <h2 className="text-2xl font-semibold">Настройки</h2>
      <Card className="space-y-4">
        <Input label="Название системы" placeholder="System-01" leftIcon={Database} />
        <div className="space-y-2">
          <span className="text-sm text-slate-300">Режим расчета</span>
          <Select value={mode} onChange={setMode} options={modeOptions} searchable />
        </div>
        <div className="space-y-2">
          <span className="text-sm text-slate-300">Интенсивность</span>
          <Slider value={intensity} onChange={(event) => setIntensity(Number(event.target.value))} />
        </div>
      </Card>
    </section>
  )
}
