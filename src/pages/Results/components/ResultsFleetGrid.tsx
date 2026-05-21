import type { ColDef } from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'
import type { CSSProperties } from 'react'
import type { SimulationResult } from '../../../api/schemaTypes'
import { Button, Card } from '../../../components/ui'
import { Download } from 'lucide-react'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'

interface ResultsFleetGridProps {
  result: SimulationResult
  columns: ColDef[]
  onExportCsv: () => void
}

export const ResultsFleetGrid = ({ result, columns, onExportCsv }: ResultsFleetGridProps) => (
  <Card
    variant="glass"
    title="Метрики по грузовикам"
    action={
      <Button size="sm" variant="secondary" leftIcon={Download} onClick={onExportCsv}>
        Скачать CSV
      </Button>
    }
    hoverable={false}
  >
    <div
      className="ag-theme-alpine h-[420px] w-full rounded-lg"
      style={
        {
          ['--ag-background-color' as string]: '#0f172a',
          ['--ag-foreground-color' as string]: '#e2e8f0',
          ['--ag-border-color' as string]: '#334155',
          ['--ag-header-background-color' as string]: '#1e293b',
        } as CSSProperties
      }
    >
      <AgGridReact rowData={result.trucks} columnDefs={columns} animateRows />
    </div>
  </Card>
)
