import { Download, Minus, Plus, Redo2, Save, Undo2 } from 'lucide-react'
import { Button } from '../../../components/ui/Button'

interface CanvasToolbarProps {
  onZoomIn: () => void
  onZoomOut: () => void
  onFitView: () => void
  onUndo: () => void
  onRedo: () => void
  onSave: () => void
  onLoad: () => void
  canUndo: boolean
  canRedo: boolean
}

export const CanvasToolbar = ({
  onZoomIn,
  onZoomOut,
  onFitView,
  onUndo,
  onRedo,
  onSave,
  onLoad,
  canUndo,
  canRedo,
}: CanvasToolbarProps) => (
  <div className="flex flex-wrap items-center gap-2 border-b border-surface-700 bg-surface-800/60 px-4 py-3 backdrop-blur-xl">
    <Button variant="ghost" size="sm" onClick={onZoomIn} leftIcon={Plus}>
      Zoom In
    </Button>
    <Button variant="ghost" size="sm" onClick={onZoomOut} leftIcon={Minus}>
      Zoom Out
    </Button>
    <Button variant="ghost" size="sm" onClick={onFitView}>
      Fit View
    </Button>
    <Button variant="secondary" size="sm" onClick={onUndo} leftIcon={Undo2} disabled={!canUndo}>
      Undo
    </Button>
    <Button variant="secondary" size="sm" onClick={onRedo} leftIcon={Redo2} disabled={!canRedo}>
      Redo
    </Button>
    <div className="ml-auto flex items-center gap-2">
      <Button variant="secondary" size="sm" onClick={onLoad} leftIcon={Download}>
        Загрузить схему
      </Button>
      <Button variant="primary" size="sm" onClick={onSave} leftIcon={Save}>
        Сохранить схему
      </Button>
    </div>
  </div>
)
