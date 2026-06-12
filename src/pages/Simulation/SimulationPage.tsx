import { Dices, RefreshCcw, Save, Settings2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, HelpTooltip, Input, Modal, Select, Slider } from '../../components/ui'

type DistanceDistribution = 'uniform' | 'normal' | 'poisson'
type OptimizationType = 'cost' | 'profit'
type PlanningMode = 'strict' | 'multiagent'

interface SimulationConfig {
  orders: number
  distanceDistribution: DistanceDistribution
  deliveryDistance: number
  pointsCount: number
  trucksCount: number
  trailersCount: number
  truckCapacity: '2' | '3'
  containerCapacity: '1' | '2'
  loadingTime: number
  transferTime: number
  shiftDuration: number
  shiftType: '8h' | '12h'
  transportCost: number
  transportExpenses: number
  emptyMileage: number
  loadingOperationCost: number
  optimizationType: OptimizationType
  planningMode: PlanningMode
  allowOverloads: boolean
  allowTrailerSwap: boolean
  dynamicReplanning: boolean
  ordersDistribution: 'uniform' | 'normal' | 'poisson'
  seed: number
}

interface PresetItem {
  name: string
  config: SimulationConfig
}

const STORAGE_KEY = 'simulation-config-v1'
const PRESETS_KEY = 'simulation-presets-v1'

const defaults: SimulationConfig = {
  orders: 1000,
  distanceDistribution: 'uniform',
  deliveryDistance: 2,
  pointsCount: 30,
  trucksCount: 50,
  trailersCount: 20,
  truckCapacity: '3',
  containerCapacity: '2',
  loadingTime: 0.5,
  transferTime: 0.5,
  shiftDuration: 8,
  shiftType: '8h',
  transportCost: 1.0,
  transportExpenses: 0.5,
  emptyMileage: 0.2,
  loadingOperationCost: 0.1,
  optimizationType: 'cost',
  planningMode: 'strict',
  allowOverloads: false,
  allowTrailerSwap: true,
  dynamicReplanning: false,
  ordersDistribution: 'poisson',
  seed: 42,
}

const Toggle = ({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}) => (
  <label className="flex items-center justify-between gap-3 rounded-lg border border-surface-700 bg-surface-900/70 px-3 py-2">
    <span className="text-sm text-slate-200">{label}</span>
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-all duration-300 ease-in-out ${
        checked ? 'bg-primary-500' : 'bg-surface-700'
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all duration-300 ease-in-out ${
          checked ? 'left-[1.35rem]' : 'left-0.5'
        }`}
      />
    </button>
  </label>
)

const getSchemaPoints = () => {
  const raw = localStorage.getItem('logistics-schema')
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw) as { nodes?: Array<Record<string, any>> } | Array<Record<string, any>>
    const nodes = Array.isArray(parsed) ? parsed : Array.isArray(parsed.nodes) ? parsed.nodes : []

    return nodes
      .filter((node) => typeof node?.type === 'string')
      .filter((node) => ['point', 'warehouse', 'Point', 'Warehouse'].includes(node.type))
      .map((node) => {
        const normalizedType = String(node.type).toLowerCase()
        const type = normalizedType === 'warehouse' ? 'warehouse' : 'point'

        return {
          id: String(node.id ?? ''),
          type: type as 'point' | 'warehouse',
          label: node?.data?.label ?? node.id ?? 'Без названия',
          orders: typeof node?.data?.orders === 'number' ? node.data.orders : undefined,
          status: node?.data?.status,
        }
      })
  } catch {
    return []
  }
}

const SchemaPointsList = () => {
  const [items, setItems] = useState<Array<{
    id: string
    type: 'point' | 'warehouse'
    label: string
    orders?: number
    status?: string
  }>>([])
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    setItems(getSchemaPoints())
  }, [])

  const visibleItems = isExpanded || items.length <= 10 ? items : items.slice(0, 10)

  return (
    <Card variant="glass" title={`Пункты схемы (${items.length})`} className="space-y-4">
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">Нет данных</p>
      ) : (
        <div className="space-y-3">
          {visibleItems.map((item) => (
            <div key={item.id} className="rounded-xl border border-surface-700 bg-surface-900/80 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-100">{item.label}</p>
                  <p className="text-xs text-slate-500">{item.type === 'warehouse' ? 'Склад' : 'Пункт'}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {item.orders !== undefined && (
                    <span className="rounded-full bg-surface-800 px-2 py-1 text-slate-300">Заказы: {item.orders}</span>
                  )}
                  <span className="rounded-full bg-surface-800 px-2 py-1 text-slate-300">Статус: {item.status ?? '—'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {items.length > 10 && (
        <button
          type="button"
          className="text-sm text-primary-300 hover:text-primary-200"
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          {isExpanded ? 'Свернуть список' : `Показать все (${items.length})`}
        </button>
      )}
    </Card>
  )
}

export const SimulationPage = () => {
  const [config, setConfig] = useState<SimulationConfig>(defaults)
  const [previewConfig, setPreviewConfig] = useState<SimulationConfig>(defaults)
  const [errors, setErrors] = useState<string[]>([])
  const [presets, setPresets] = useState<PresetItem[]>([])
  const [selectedPreset, setSelectedPreset] = useState('')
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false)
  const [presetName, setPresetName] = useState('')

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    const storedPresets = localStorage.getItem(PRESETS_KEY)
    if (stored) {
      try {
        setConfig({ ...defaults, ...(JSON.parse(stored) as Partial<SimulationConfig>) })
      } catch {
        setConfig(defaults)
      }
    }
    if (storedPresets) {
      try {
        setPresets(JSON.parse(storedPresets) as PresetItem[])
      } catch {
        setPresets([])
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    const nextErrors: string[] = []
    if (config.trailersCount > config.trucksCount) {
      nextErrors.push('Количество прицепов не может быть больше количества грузовиков.')
    }
    if (config.loadingTime + config.transferTime > config.shiftDuration) {
      nextErrors.push('Суммарное время погрузки и перемещения не должно превышать длительность смены.')
    }
    setErrors(nextErrors)
  }, [config])

  useEffect(() => {
    const timer = window.setTimeout(() => setPreviewConfig(config), 500)
    return () => window.clearTimeout(timer)
  }, [config])

  const costDistribution = useMemo(() => {
    const total =
      previewConfig.transportCost +
      previewConfig.transportExpenses +
      previewConfig.emptyMileage +
      previewConfig.loadingOperationCost
    const transport = (previewConfig.transportCost / total) * 100
    const expenses = (previewConfig.transportExpenses / total) * 100
    const empty = (previewConfig.emptyMileage / total) * 100
    const loading = 100 - transport - expenses - empty
    return { transport, expenses, empty, loading }
  }, [previewConfig])

  const expectedDeliveryTime = useMemo(
    () => (previewConfig.loadingTime + previewConfig.transferTime * previewConfig.deliveryDistance).toFixed(2),
    [previewConfig],
  )

  const fleetLoad = useMemo(() => {
    const truckCapacity = Number(previewConfig.truckCapacity)
    const containerCapacity = Number(previewConfig.containerCapacity)
    const maxOrders = previewConfig.trucksCount * truckCapacity * containerCapacity
    return Math.min(100, Math.round((previewConfig.orders / Math.max(1, maxOrders)) * 100))
  }, [previewConfig])

  const update = <K extends keyof SimulationConfig>(key: K, value: SimulationConfig[K]) =>
    setConfig((prev) => ({ ...prev, [key]: value }))

  const handleReset = () => setConfig(defaults)

  const handleSavePreset = () => {
    if (!presetName.trim()) return
    const next = [...presets.filter((item) => item.name !== presetName.trim()), { name: presetName.trim(), config }]
    setPresets(next)
    localStorage.setItem(PRESETS_KEY, JSON.stringify(next))
    setSelectedPreset(presetName.trim())
    setPresetName('')
    setIsPresetModalOpen(false)
  }

  const handleLoadPreset = (name: string) => {
    setSelectedPreset(name)
    const found = presets.find((item) => item.name === name)
    if (found) setConfig(found.config)
  }

  const randomSeed = () => update('seed', Math.floor(Math.random() * 1_000_000))

  const pieStyle = {
    background: `conic-gradient(#3b82f6 0% ${costDistribution.transport}%, #10b981 ${costDistribution.transport}% ${
      costDistribution.transport + costDistribution.expenses
    }%, #f59e0b ${costDistribution.transport + costDistribution.expenses}% ${
      costDistribution.transport + costDistribution.expenses + costDistribution.empty
    }%, #ef4444 ${costDistribution.transport + costDistribution.expenses + costDistribution.empty}% 100%)`,
  }

  return (
    <section className="animate-slide-up space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Параметры симуляции</h2>
          <p className="text-sm text-slate-400">Гибкая конфигурация логистической модели с live-предпросмотром.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            className="w-56"
            value={selectedPreset}
            placeholder="Загрузить пресет"
            options={presets.map((item) => ({ value: item.name, label: item.name }))}
            onChange={handleLoadPreset}
          />
          <Button size="sm" variant="secondary" leftIcon={Save} onClick={() => setIsPresetModalOpen(true)}>
            Сохранить как пресет
          </Button>
          <Button size="sm" variant="ghost" leftIcon={RefreshCcw} onClick={handleReset}>
            Сбросить defaults
          </Button>
        </div>
      </div>

      {!!errors.length && (
        <Card variant="outlined" className="border-danger/60 bg-danger/10">
          <p className="mb-2 text-sm font-semibold text-danger">Ошибки валидации</p>
          <ul className="space-y-1 text-sm text-slate-200">
            {errors.map((error) => (
              <li key={error}>- {error}</li>
            ))}
          </ul>
        </Card>
      )}

      <SchemaPointsList />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="space-y-4 xl:col-span-3">
          <Card variant="glass" title="📦 Логистика" hoverable={false} className="space-y-4">
            <Slider min={100} max={2000} value={config.orders} onChange={(e) => update('orders', Number(e.target.value))} />
            <Select
              value={config.distanceDistribution}
              options={[
                { value: 'uniform', label: 'Равномерное' },
                { value: 'normal', label: 'Нормальное' },
                { value: 'poisson', label: 'Пуассона' },
              ]}
              onChange={(value) => update('distanceDistribution', value as DistanceDistribution)}
            />
            <Slider min={1} max={3} value={config.deliveryDistance} onChange={(e) => update('deliveryDistance', Number(e.target.value))} />
            <Input
              label="Количество пунктов"
              type="number"
              min={10}
              max={100}
              value={config.pointsCount}
              onChange={(e) => update('pointsCount', Number(e.target.value))}
            />
          </Card>

          <Card variant="glass" title="🚛 Транспорт" hoverable={false} className="space-y-4">
            <Slider min={10} max={100} value={config.trucksCount} onChange={(e) => update('trucksCount', Number(e.target.value))} />
            <Slider min={0} max={50} value={config.trailersCount} onChange={(e) => update('trailersCount', Number(e.target.value))} />
            <Select
              value={config.truckCapacity}
              options={[
                { value: '2', label: '2 контейнера' },
                { value: '3', label: '3 контейнера' },
              ]}
              onChange={(value) => update('truckCapacity', value as '2' | '3')}
            />
            <Select
              value={config.containerCapacity}
              options={[
                { value: '1', label: '1 заказ' },
                { value: '2', label: '2 заказа' },
              ]}
              onChange={(value) => update('containerCapacity', value as '1' | '2')}
            />
          </Card>

          <Card variant="glass" title="⏱️ Время" hoverable={false} className="space-y-4">
            <Slider min={0.1} max={2} step={0.1} value={config.loadingTime} onChange={(e) => update('loadingTime', Number(e.target.value))} />
            <Slider min={0.1} max={2} step={0.1} value={config.transferTime} onChange={(e) => update('transferTime', Number(e.target.value))} />
            <Slider min={4} max={16} value={config.shiftDuration} onChange={(e) => update('shiftDuration', Number(e.target.value))} />
            <Toggle label="Смена 8ч / 12ч" checked={config.shiftType === '12h'} onChange={(checked) => update('shiftType', checked ? '12h' : '8h')} />
          </Card>

          <Card variant="glass" title="💰 Экономика" hoverable={false} className="space-y-4 border-primary-500/60">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-sm text-slate-300">
                <span>Стоимость перевозки (у.е./плечо)</span>
                <HelpTooltip text="Стоимость перевозки 1 заказа по 1 плечу (усл. ед.)" />
              </div>
              <Input type="number" step={0.1} value={config.transportCost} onChange={(e) => update('transportCost', Number(e.target.value))} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-sm text-slate-300">
                <span>Затраты на перевозку</span>
                <HelpTooltip text="Дополнительные эксплуатационные расходы на перевозку в расчёте на плечо." />
              </div>
              <Input type="number" step={0.1} value={config.transportExpenses} onChange={(e) => update('transportExpenses', Number(e.target.value))} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-sm text-slate-300">
                <span>Порожний пробег</span>
                <HelpTooltip text="Расстояние, которое грузовик проходит пустым, в условных единицах на плечо." />
              </div>
              <Input type="number" step={0.1} value={config.emptyMileage} onChange={(e) => update('emptyMileage', Number(e.target.value))} />
            </div>

            <div className="space-y-2">
              <p className="text-sm text-slate-300">Операция погрузки</p>
              <Input
                type="number"
                step={0.1}
                value={config.loadingOperationCost}
                onChange={(e) => update('loadingOperationCost', Number(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-sm text-slate-300">
                <span>Оптимизация</span>
                <HelpTooltip text="cost — минимизация затрат, profit — максимизация прибыли." />
              </div>
              <Select
                value={config.optimizationType}
                options={[
                  { value: 'cost', label: 'Минимизация затрат' },
                  { value: 'profit', label: 'Максимизация прибыли' },
                ]}
                onChange={(value) => update('optimizationType', value as OptimizationType)}
              />
            </div>
          </Card>

          <Card variant="glass" title="🤖 Поведение системы" hoverable={false} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-sm text-slate-300">
                <span>Режим</span>
                <HelpTooltip text="strict — жёсткий план, multiagent — агенты договариваются и адаптируются." />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => update('planningMode', 'strict')}
                  className={`rounded-lg border px-3 py-2 text-sm transition-all duration-300 ease-in-out ${
                    config.planningMode === 'strict'
                      ? 'border-primary-500 bg-primary-500/20 text-primary-300'
                      : 'border-surface-700 bg-surface-900 text-slate-300'
                  }`}
                >
                  Жесткое планирование
                </button>
                <button
                  type="button"
                  onClick={() => update('planningMode', 'multiagent')}
                  className={`rounded-lg border px-3 py-2 text-sm transition-all duration-300 ease-in-out ${
                    config.planningMode === 'multiagent'
                      ? 'border-primary-500 bg-primary-500/20 text-primary-300'
                      : 'border-surface-700 bg-surface-900 text-slate-300'
                  }`}
                >
                  Мультиагентное
                </button>
              </div>
            </div>
            <Toggle label="Разрешить перегрузки" checked={config.allowOverloads} onChange={(value) => update('allowOverloads', value)} />
            <Toggle label="Разрешить замену прицепов" checked={config.allowTrailerSwap} onChange={(value) => update('allowTrailerSwap', value)} />
            <Toggle
              label="Динамическое перепланирование"
              checked={config.dynamicReplanning}
              disabled={config.planningMode !== 'multiagent'}
              onChange={(value) => update('dynamicReplanning', value)}
            />
          </Card>

          <Card variant="glass" title="🎲 Стохастика" hoverable={false} className="space-y-4">
            <Select
              value={config.ordersDistribution}
              options={[
                { value: 'uniform', label: 'Равномерное' },
                { value: 'normal', label: 'Нормальное' },
                { value: 'poisson', label: 'Пуассона' },
              ]}
              onChange={(value) => update('ordersDistribution', value as SimulationConfig['ordersDistribution'])}
            />
            <div className="flex items-end gap-2">
              <Input
                className="flex-1"
                label="Seed генератора"
                type="number"
                value={config.seed}
                onChange={(e) => update('seed', Number(e.target.value))}
              />
              <Button variant="secondary" size="sm" leftIcon={Dices} onClick={randomSeed}>
                Random
              </Button>
            </div>
          </Card>
        </div>

        <div className="xl:col-span-2">
          <div className="sticky top-20 space-y-4">
            <Card variant="glass" title="Предпросмотр конфигурации" hoverable={false}>
              <div className="mb-4 flex items-center gap-2 text-xs text-slate-400">
                <Settings2 size={14} />
                Обновление предпросмотра: 500ms debounce
              </div>
              <div className="mx-auto mb-4 h-44 w-44 rounded-full p-4" style={pieStyle}>
                <div className="flex h-full w-full items-center justify-center rounded-full bg-surface-900 text-center">
                  <span className="text-sm text-slate-300">Затраты</span>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <p className="flex items-center justify-between text-slate-300">
                  <span>Ожидаемое время доставки</span>
                  <span className="font-mono text-slate-100">{expectedDeliveryTime} ч</span>
                </p>
                <p className="flex items-center justify-between text-slate-300">
                  <span>Загрузка парка</span>
                  <span className="font-mono text-success">{fleetLoad}%</span>
                </p>
              </div>
            </Card>

            <Card variant="outlined" hoverable={false} className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Состав затрат</p>
              <p className="flex items-center justify-between text-sm text-slate-300">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary-500" />
                  Перевозка
                </span>
                <span className="font-mono">{costDistribution.transport.toFixed(1)}%</span>
              </p>
              <p className="flex items-center justify-between text-sm text-slate-300">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-success" />
                  Эксплуатация
                </span>
                <span className="font-mono">{costDistribution.expenses.toFixed(1)}%</span>
              </p>
              <p className="flex items-center justify-between text-sm text-slate-300">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-warning" />
                  Порожний пробег
                </span>
                <span className="font-mono">{costDistribution.empty.toFixed(1)}%</span>
              </p>
              <p className="flex items-center justify-between text-sm text-slate-300">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-danger" />
                  Погрузка
                </span>
                <span className="font-mono">{costDistribution.loading.toFixed(1)}%</span>
              </p>
            </Card>

            <div className="flex justify-end">
              <Badge variant="success">Готово к запуску</Badge>
            </div>
          </div>
        </div>
      </div>

      <Modal open={isPresetModalOpen} onClose={() => setIsPresetModalOpen(false)} title="Сохранить пресет" size="sm">
        <div className="space-y-4">
          <Input label="Название пресета" value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder="Например: Пиковая нагрузка" />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setIsPresetModalOpen(false)}>
              Отмена
            </Button>
            <Button size="sm" onClick={handleSavePreset} disabled={!presetName.trim()}>
              Сохранить
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  )
}
