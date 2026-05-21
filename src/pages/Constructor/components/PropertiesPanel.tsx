import { Square, Truck } from 'lucide-react'
import { Button, Input, Select } from '../../../components/ui'
import type { LogisticsEdge, LogisticsNode, LogisticsNodeData } from '../types'

interface PropertiesPanelProps {
  selectedNode: LogisticsNode | null
  selectedEdge: LogisticsEdge | null
  draft: LogisticsNodeData
  setDraft: (draft: LogisticsNodeData) => void
  destinationNodes: LogisticsNode[]
  isTruckAnimating?: boolean
  onMoveTruck: () => void
  onStopTruck: () => void
  onTruckDestinationChange: (targetNodeId: string) => void
  onApply: () => void
  onCancel: () => void
  onDelete: () => void
}

export const PropertiesPanel = ({
  selectedNode,
  selectedEdge,
  draft,
  setDraft,
  destinationNodes,
  isTruckAnimating = false,
  onMoveTruck,
  onStopTruck,
  onTruckDestinationChange,
  onApply,
  onCancel,
  onDelete,
}: PropertiesPanelProps) => {
  const destinationOptions = destinationNodes
    .filter((node) => node.id !== selectedNode?.id)
    .map((node) => ({
      value: node.id,
      label: `${node.type === 'warehouse' ? 'Склад' : 'Пункт'}: ${node.data.label}`,
    }))
  if (!selectedNode && !selectedEdge) return null

  return (
    <aside className="w-80 animate-slide-in-right border-l border-surface-700 bg-surface-800/70 p-4 backdrop-blur-xl">
      <h3 className="mb-4 text-base font-semibold text-slate-100">Панель свойств</h3>
      {selectedNode && (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Нода: {selectedNode.type}</p>
          <Input label="Название / ID" value={draft.label ?? ''} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
          <Input label="Описание" value={draft.subtitle ?? ''} onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })} />

          {selectedNode.type === 'point' && (
            <>
              <Input
                label="Очередь заказов"
                type="number"
                value={draft.queue ?? 0}
                onChange={(e) => setDraft({ ...draft, queue: Number(e.target.value) })}
              />
              <Input
                label="Координаты"
                value={`${Math.round(selectedNode.position.x)}, ${Math.round(selectedNode.position.y)}`}
                disabled
              />
            </>
          )}

          {selectedNode.type === 'warehouse' && (
            <Input
              label="Пропускная способность"
              type="number"
              value={draft.throughput ?? 0}
              onChange={(e) => setDraft({ ...draft, throughput: Number(e.target.value) })}
            />
          )}

          {selectedNode.type === 'truck' && (
            <>
              <Input
                label="Вместимость"
                type="number"
                value={draft.capacity ?? 0}
                onChange={(e) => setDraft({ ...draft, capacity: Number(e.target.value) })}
              />
              <Input
                label="Текущая загрузка (%)"
                type="number"
                value={draft.load ?? 0}
                onChange={(e) => setDraft({ ...draft, load: Number(e.target.value) })}
              />
              <Input label="Прицеп" value={draft.trailer ?? ''} onChange={(e) => setDraft({ ...draft, trailer: e.target.value })} />
              <div className="space-y-2">
                <span className="text-sm text-slate-300">Пункт назначения</span>
                <Select
                  value={draft.targetNodeId ?? ''}
                  onChange={onTruckDestinationChange}
                  options={destinationOptions}
                  placeholder="Выберите склад или пункт"
                  disabled={isTruckAnimating}
                />
              </div>
              {draft.targetLabel && (
                <p className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
                  Маршрут: → {draft.targetLabel}
                </p>
              )}
              <p className="text-xs text-slate-500">
                {isTruckAnimating
                  ? 'Грузовик едет к цели. На схеме показана пунктирная линия направления.'
                  : 'Нажмите кнопку — грузовик плавно поедет к выбранной цели.'}
              </p>
              {isTruckAnimating ? (
                <Button
                  size="sm"
                  variant="danger"
                  leftIcon={Square}
                  onClick={onStopTruck}
                  className="w-full"
                >
                  Остановить
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={Truck}
                  onClick={onMoveTruck}
                  disabled={!draft.targetNodeId}
                  className="w-full"
                >
                  Сдвинуть к цели
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {selectedEdge && (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Ребро маршрута</p>
          <Input label="Расстояние" value={selectedEdge.data?.distance ?? ''} disabled />
          <Input label="Загрузка маршрута (%)" value={selectedEdge.data?.routeLoad ?? 0} disabled />
        </div>
      )}

      <div className="mt-6 flex items-center gap-2">
        <Button size="sm" onClick={onApply}>
          Применить
        </Button>
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Отмена
        </Button>
        <Button variant="danger" size="sm" onClick={onDelete}>
          Удалить
        </Button>
      </div>
    </aside>
  )
}
