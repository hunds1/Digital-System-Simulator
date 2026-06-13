import {   Activity,  BarChart3,  CheckCircle2,  ChevronLeft,  ChevronRight,  Clock3,  Loader2,  Pause,  Play,  Save,  Truck } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ColDef } from 'ag-grid-community'
import { endpoints } from '../../api/endpoints'
import { adaptHeatmap, type HeatmapCell, type SimulationResult } from '../../api/schemaTypes'
import { Badge, Button, Card, HelpTooltip, Tabs, useToast } from '../../components/ui'
import { useSimulationRunStore } from '../../store/simulationRunStore'
import { useSettingsStore } from '../../store/settingsStore'
import { getNetworkSchema } from '../Simulation/SimulationPage'

const ResultsOverviewCharts = lazy(() =>
  import('./components/ResultsOverviewCharts').then((module) => ({ default: module.ResultsOverviewCharts })),
)
const ResultsFleetGrid = lazy(() =>
  import('./components/ResultsFleetGrid').then((module) => ({ default: module.ResultsFleetGrid })),
)

type RunState = 'idle' | 'running' | 'completed'
type WsStatus = 'connected' | 'reconnecting' | 'done'

const SIM_CONFIG_KEY = 'simulation-config-v1'
const progressSteps = ['Генерация заказов...', 'Распределение...', 'Расчет метрик...']

const mockResult = (id: string): SimulationResult => ({
  id,
  mode: Math.random() > 0.5 ? 'multiagent' : 'strict',
  completionPercent: 96,
  ordersTotal: 1000,
  ordersCompleted: 963,
  averageTruckLoad: 78,
  totalCost: 128.42,
  simulationSeconds: 17,
  timeline: Array.from({ length: 10 }, (_, index) => ({
    time: index * 2,
    completed: Math.min(1000, Math.round((index / 9) * 963)),
  })),
  truckLoadByHour: Array.from({ length: 8 }, (_, index) => ({
    hour: `${index + 1}:00`,
    load: 52 + Math.round(Math.random() * 45),
  })),
  statusDistribution: [
    { name: 'idle', value: 16 },
    { name: 'moving', value: 58 },
    { name: 'loading', value: 26 },
  ],
  comparison: {
    deliveryRate: { strict: 91.8, multiagent: 96.3 },
    cost: { strict: 137.25, multiagent: 128.42 },
    overloads: { strict: 14, multiagent: 6 },
    trailerSwaps: { strict: 8, multiagent: 12 },
  },
  trucks: Array.from({ length: 18 }, (_, index) => ({
    id: `TR-${index + 1}`,
    completedOrders: 35 + Math.round(Math.random() * 40),
    overloads: Math.round(Math.random() * 4),
    trailerSwaps: Math.round(Math.random() * 3),
    load: 50 + Math.round(Math.random() * 45),
    mileage: 100 + Math.round(Math.random() * 220),
  })),
  heatmap: Array.from({ length: 30 }, (_, index) => ({
    x: index % 6,
    y: Math.floor(index / 6),
    value: Math.round(Math.random() * 12),
  })),
  createdAt: new Date().toISOString(),
})

export const ResultsPage = () => {
  const { showToast } = useToast()
  const { selectedParameters, setSelectedParameters, history, addHistoryItem } = useSimulationRunStore()
  const { systemName, calculationMode, intensity } = useSettingsStore()
  const [runState, setRunState] = useState<RunState>('idle')
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState(progressSteps[0])
  const [elapsed, setElapsed] = useState(0)
  const [wsStatus, setWsStatus] = useState<WsStatus>('reconnecting')
  const [activeResult, setActiveResult] = useState<SimulationResult | null>(null)
  const [historyOpen, setHistoryOpen] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [isPaused, setIsPaused] = useState(false)
  const socketRef = useRef<WebSocket | null>(null)

  const parametersSummary = useMemo(() => {
    // Always read FRESH config from localStorage (SimulationPage writes here on every change)
    const localRaw = localStorage.getItem(SIM_CONFIG_KEY)
    let params: Record<string, unknown> = {}
    if (localRaw) {
      try {
        params = JSON.parse(localRaw) as Record<string, unknown>
      } catch {
        // ignore
      }
    }
    // Merge settings store values (Settings page: systemName, calculationMode, intensity)
    return {
      ...params,
      systemName,
      calculationMode,
      intensity,
    }
  }, [systemName, calculationMode, intensity])

  useEffect(() => {
    if (Object.keys(parametersSummary).length) {
      setSelectedParameters(parametersSummary)
    }
  }, [parametersSummary, setSelectedParameters])

  useEffect(() => {
    if (runState !== 'running') return
    const start = Date.now()
    const timer = window.setInterval(() => {
      setElapsed(Math.round((Date.now() - start) / 1000))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [runState])

  const handleExportCsv = useCallback(() => {
    if (!activeResult) return
    const headers = ['ID', 'Выполнено заказов', 'Перегрузки', 'Замены прицепов', 'Загрузка%', 'Пробег']
    const rows = activeResult.trucks.map((item) =>
      [item.id, item.completedOrders, item.overloads, item.trailerSwaps, item.load, item.mileage].join(','),
    )
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `simulation-${activeResult.id}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }, [activeResult])

  const handleSaveReport = useCallback(() => {
    if (!activeResult) return
    const blob = new Blob([JSON.stringify(activeResult, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `simulation-report-${activeResult.id}.json`
    link.click()
    URL.revokeObjectURL(url)
  }, [activeResult])

  const handlePause = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'PAUSE' }))
      setIsPaused(true)
    }
  }, [])

  const handleResume = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'RESUME' }))
      setIsPaused(false)
    }
  }, [])

  const startSimulation = useCallback(async () => {
    setRunState('running')
    setProgress(0)
    setCurrentStep(progressSteps[0])
    setElapsed(0)
    setWsStatus('reconnecting')
    setIsPaused(false)

    // 1. POST parameters to backend to get simulation ID
    let simulationId: string
    const useNetworkToggle = localStorage.getItem('simulation-use-network') !== 'false'
    const network = useNetworkToggle ? getNetworkSchema() : null
    try {
      const { planningMode, ...restParams } = parametersSummary as Record<string, unknown>
      const start = await endpoints.startSimulation({
        mode: (planningMode as 'strict' | 'multiagent') ?? 'strict',
        parameters: {
          ...restParams,
          planningMode,
          systemName,
          calculationMode,
          intensity,
        },
        network,
      })
      simulationId = start.id
    } catch {
      showToast({
        variant: 'warning',
        title: 'API недоступен',
        description: 'Запуск продолжается в демо-режиме.',
      })
      // Fallback: demo mode with mock result
      const demoId = `local-${Date.now()}`
      const progressTimer = window.setInterval(() => {
        setProgress((prev) => {
          const next = Math.min(100, prev + 7)
          if (next < 35) setCurrentStep(progressSteps[0])
          else if (next < 75) setCurrentStep(progressSteps[1])
          else setCurrentStep(progressSteps[2])
          return next
        })
      }, 420)
      window.setTimeout(() => {
        window.clearInterval(progressTimer)
        const result = mockResult(demoId)
        setActiveResult(result)
        addHistoryItem({
          id: result.id,
          date: new Date(result.createdAt).toLocaleString('ru-RU'),
          mode: result.mode,
          completionPercent: result.completionPercent,
          miniSeries: result.timeline.map((item) => item.completed),
          result,
        })
        setRunState('completed')
        showToast({ variant: 'success', title: 'Симуляция завершена (демо)' })
      }, 6200)
      return
    }

    // 2. Open WebSocket for real-time tick streaming
    const wsBase = (import.meta.env.VITE_WS_BASE_URL as string | undefined) ?? 'ws://localhost:3001/ws/simulation'
    const socket = new WebSocket(`${wsBase}/${simulationId}`)
    socketRef.current = socket

    socket.onopen = () => {
      setWsStatus('connected')
      // Send INIT message with parameters + network so the WS engine uses real topology
      const { planningMode, ...restParams } = parametersSummary as Record<string, unknown>
      socket.send(JSON.stringify({
        type: 'INIT',
        parameters: {
          ...restParams,
          planningMode,
          systemName,
          calculationMode,
          intensity,
        },
        network,
      }))
    }

    socket.onmessage = (event) => {
      let msg: Record<string, unknown>
      try {
        msg = JSON.parse(event.data as string)
      } catch {
        return
      }

      if (msg.type === 'TICK') {
        const hour = msg.hour as number
        const totalHours = 8
        const pct = Math.min(99, Math.round((hour / totalHours) * 100))
        setProgress(pct)
        if (pct < 35) setCurrentStep(progressSteps[0])
        else if (pct < 75) setCurrentStep(progressSteps[1])
        else setCurrentStep(progressSteps[2])
      } else if (msg.type === 'COMPLETE') {
        const data = msg.data as SimulationResult
        setWsStatus('done')
        socket.close()
        setProgress(100)
        setActiveResult(data)
        addHistoryItem({
          id: data.id,
          date: new Date(data.createdAt).toLocaleString('ru-RU'),
          mode: data.mode,
          completionPercent: data.completionPercent,
          miniSeries: data.timeline.map((item) => item.completed),
          result: data,
        })
        setRunState('completed')
        showToast({ variant: 'success', title: 'Симуляция завершена' })
      }
    }

    socket.onerror = () => setWsStatus('reconnecting')
    socket.onclose = () => {
      setWsStatus((prev) => (prev === 'done' ? 'done' : 'reconnecting'))
      socketRef.current = null
    }
  }, [addHistoryItem, parametersSummary, showToast, systemName, calculationMode, intensity])

  const comparisonRows = useMemo(() => {
    if (!activeResult) return []
    const c = activeResult.comparison
    return [
      { metric: 'Доставка %', strict: c.deliveryRate.strict, multiagent: c.deliveryRate.multiagent, better: 'high' },
      { metric: 'Стоимость', strict: c.cost.strict, multiagent: c.cost.multiagent, better: 'low' },
      { metric: 'Перегрузки', strict: c.overloads.strict, multiagent: c.overloads.multiagent, better: 'low' },
      { metric: 'Смены прицепов', strict: c.trailerSwaps.strict, multiagent: c.trailerSwaps.multiagent, better: 'low' },
    ]
  }, [activeResult])

  const columns = useMemo<ColDef[]>(
    () => [
      { field: 'id', headerName: 'ID', sortable: true, filter: true },
      { field: 'completedOrders', headerName: 'Выполнено заказов', sortable: true, filter: true },
      { field: 'overloads', headerName: 'Перегрузки', sortable: true, filter: true },
      { field: 'trailerSwaps', headerName: 'Замены прицепов', sortable: true, filter: true },
      { field: 'load', headerName: 'Загрузка%', sortable: true, filter: true },
      { field: 'mileage', headerName: 'Пробег', sortable: true, filter: true },
    ],
    [],
  )

  const tabs = [
    { key: 'overview', label: 'Обзор', icon: BarChart3 },
    { key: 'fleet', label: 'Грузовики', icon: Truck },
    { key: 'heatmap', label: 'Heatmap', icon: Activity },
  ]

  const lazyFallback = (
    <Card variant="glass" hoverable={false}>
      <div className="flex items-center gap-2 text-slate-300">
        <Loader2 size={16} className="animate-spin text-primary-400" />
        Загрузка виджета...
      </div>
    </Card>
  )

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Запуск и результаты симуляции</h2>
        <Badge variant={wsStatus === 'connected' ? 'success' : wsStatus === 'done' ? 'success' : 'warning'}>
          {wsStatus === 'connected' ? 'Подключен ✓' : wsStatus === 'done' ? 'Завершено ✓' : 'Переподключение...'}
        </Badge>
      </div>

      <div className="flex gap-4">
        <aside
          className={`rounded-xl border border-surface-700 bg-surface-800/70 transition-all duration-300 ease-in-out ${
            historyOpen ? 'w-72 p-4' : 'w-12 p-2'
          }`}
        >
          <button
            type="button"
            onClick={() => setHistoryOpen((prev) => !prev)}
            className="mb-3 rounded-md bg-surface-700 p-1.5 text-slate-200"
          >
            {historyOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
          {historyOpen && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-200">История запусков</p>
              {history.length === 0 && <p className="text-xs text-slate-500">Пока нет запусков</p>}
              {history.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveResult(item.result)
                    setRunState('completed')
                  }}
                  className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-left hover:border-primary-500/60"
                >
                  <p className="text-xs text-slate-400">{item.date}</p>
                  <p className="text-sm text-slate-100">{item.mode === 'strict' ? 'Жесткое' : 'Мультиагент'}</p>
                  <p className="text-xs text-primary-400">{item.completionPercent}%</p>
                  <div className="mt-2 flex h-6 items-end gap-[2px]">
                    {item.miniSeries.slice(-18).map((value, index) => (
                      <span key={`${item.id}-${index}`} className="w-1 rounded-sm bg-primary-500/70" style={{ height: `${Math.max(15, value / 12)}%` }} />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        <div className="flex-1 space-y-4">
          {runState !== 'completed' && (
            <div className="animate-fade-in space-y-4">
              <Card variant="glass" hoverable={false}>
                <h3 className="mb-2 text-2xl font-semibold">Запуск симуляции</h3>
                <p className="text-sm text-slate-400">Подготовьте параметры, затем запустите расчет.</p>
              </Card>

              <Card
                variant="glass"
                hoverable={false}
                title="Выбранные параметры"
                action={<Badge variant="online">{Object.keys(parametersSummary).length ? 'Из Store' : 'Нет данных'}</Badge>}
              >
                <div className="grid gap-2 text-sm text-slate-300 md:grid-cols-2">
                  {Object.entries(parametersSummary).slice(0, 10).map(([key, value]) => (
                    <p key={key} className="flex items-center justify-between rounded-md bg-surface-900/70 px-3 py-2">
                      <span>{key}</span>
                      <span className="font-mono text-slate-100">{String(value)}</span>
                    </p>
                  ))}
                </div>
              </Card>

              <Card variant="glass" hoverable={false} className="space-y-4">
                <div className="flex gap-3">
                  {runState === 'running' && !isPaused && (
                  <Button
                    size="lg"
                    variant="secondary"
                    leftIcon={Pause}
                    onClick={handlePause}
                    className="flex-1"
                  >
                    ⏸ Пауза
                  </Button>
                )}
                {runState === 'running' && isPaused && (
                  <Button
                    size="lg"
                    variant="secondary"
                    leftIcon={Play}
                    onClick={handleResume}
                    className="flex-1"
                  >
                    ▶ Продолжить
                  </Button>
                )}
                <Button
                  size="lg"
                  loading={runState === 'running'}
                  leftIcon={Play}
                  onClick={startSimulation}
                  className="flex-1 animate-pulse-glow"
                >
                  ▶ Запустить
                  </Button>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-slate-300">{currentStep}</span>
                    <span className="font-mono text-primary-300">{progress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-700">
                    <div className="h-full bg-primary-gradient transition-all duration-300 ease-in-out" style={{ width: `${progress}%` }} />
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  {progressSteps.map((step, index) => (
                    <div key={step} className="flex items-center gap-2 rounded-md border border-surface-700 bg-surface-900 px-3 py-2 text-xs text-slate-300">
                      {progress / 34 > index ? (
                        <CheckCircle2 size={14} className="text-success" />
                      ) : (
                        <Loader2 size={14} className={index === Math.floor(progress / 34) ? 'animate-spin text-primary-400' : 'text-slate-500'} />
                      )}
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
                <p className="flex items-center gap-2 text-sm text-slate-400">
                  <Clock3 size={14} />
                  elapsed: <span className="font-mono text-slate-200">{elapsed}s</span>
                </p>
              </Card>
            </div>
          )}

          {runState === 'completed' && activeResult && (
            <div className="animate-fade-in space-y-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card variant="glass" hoverable={false}>
                  <p className="text-sm text-slate-400">Выполнено заказов</p>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="font-mono text-2xl text-slate-100">
                      {activeResult.ordersCompleted}/{activeResult.ordersTotal}
                    </p>
                    <div className="h-12 w-12 rounded-full border-4 border-success/40 border-t-success" />
                  </div>
                </Card>
                <Card variant="glass" hoverable={false}>
                  <p className="text-sm text-slate-400">Средняя загрузка грузовика</p>
                  <p className="mt-3 font-mono text-2xl text-primary-400">{activeResult.averageTruckLoad}%</p>
                </Card>
                <Card variant="glass" hoverable={false}>
                  <p className="text-sm text-slate-400">Общие затраты</p>
                  <p className="mt-3 font-mono text-2xl text-danger">-{activeResult.totalCost.toFixed(2)} у.е.</p>
                </Card>
                <Card variant="glass" hoverable={false}>
                  <p className="text-sm text-slate-400">Время симуляции</p>
                  <p className="mt-3 font-mono text-2xl text-success">{activeResult.simulationSeconds} сек</p>
                </Card>
              </div>

              <Card variant="glass" title="Сравнение режимов" hoverable={false}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-sm">
                    <thead>
                      <tr className="border-b border-surface-700 text-left text-slate-400">
                        <th className="pb-2">
                          <div className="inline-flex items-center gap-2">
                            Метрика
                            <HelpTooltip text="Показатель сравнения эффективности разных режимов симуляции." />
                          </div>
                        </th>
                        <th className="pb-2">
                          <div className="inline-flex items-center gap-2">
                            Жесткое
                            <HelpTooltip text="Результат для жёсткого (strict) режима планирования." />
                          </div>
                        </th>
                        <th className="pb-2">
                          <div className="inline-flex items-center gap-2">
                            Мультиагент
                            <HelpTooltip text="Результат для мультиагентного (multiagent) режима планирования." />
                          </div>
                        </th>
                        <th className="pb-2">
                          <div className="inline-flex items-center gap-2">
                            Разница
                            <HelpTooltip text="Разница между мультиагентным и жёстким режимами." />
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonRows.map((row) => {
                        const diff = row.multiagent - row.strict
                        const strictBest = row.better === 'high' ? row.strict >= row.multiagent : row.strict <= row.multiagent
                        const multiBest = !strictBest
                        return (
                          <tr key={row.metric} className="border-b border-surface-800 text-slate-200">
                            <td className="py-2">{row.metric}</td>
                            <td className={`py-2 ${strictBest ? 'text-success' : 'text-danger'}`}>{row.strict}</td>
                            <td className={`py-2 ${multiBest ? 'text-success' : 'text-danger'}`}>{row.multiagent}</td>
                            <td className={`py-2 font-mono ${diff >= 0 ? 'text-success' : 'text-danger'}`}>{diff >= 0 ? '+' : ''}{diff.toFixed(2)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Tabs items={tabs} activeTab={activeTab} onChange={setActiveTab} />

              {activeTab === 'overview' && (
                <Suspense fallback={lazyFallback}>
                  <ResultsOverviewCharts result={activeResult} />
                </Suspense>
              )}

              {activeTab === 'fleet' && (
                <Suspense fallback={lazyFallback}>
                  <ResultsFleetGrid result={activeResult} columns={columns} onExportCsv={handleExportCsv} />
                </Suspense>
              )}

              {activeTab === 'heatmap' && (
                <Card variant="glass" title="Распределение по пунктам (Пункты × Грузовики)" action={<Button size="sm" leftIcon={Save} onClick={handleSaveReport}>Сохранить отчет</Button>} hoverable={false}>
                  <div className="overflow-x-auto">
                    <div className="grid min-w-[720px] grid-cols-6 gap-2">
                      {adaptHeatmap(activeResult.heatmap, activeResult.pointLabels).map((cell: HeatmapCell, index: number) => (
                        <div
                          key={`${cell.point}-${cell.truck}-${index}`}
                          className="rounded-md border border-surface-700 p-2 text-xs"
                          style={{ backgroundColor: `rgba(59, 130, 246, ${Math.min(0.9, cell.orders / 12)})` }}
                        >
                          <p className="text-slate-100">{cell.point}</p>
                          <p className="text-slate-200">{cell.truck}</p>
                          <p className="font-mono text-white">{cell.orders}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
