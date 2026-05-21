import { Cell, Bar, BarChart, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { SimulationResult } from '../../../api/schemaTypes'
import { Card } from '../../../components/ui'

interface ResultsOverviewChartsProps {
  result: SimulationResult
}

export const ResultsOverviewCharts = ({ result }: ResultsOverviewChartsProps) => (
  <div className="grid gap-4 xl:grid-cols-3">
    <Card variant="glass" title="Выполнение заказов во времени" hoverable={false} className="xl:col-span-2">
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={result.timeline}>
            <XAxis dataKey="time" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip />
            <Line type="monotone" dataKey="completed" stroke="#3b82f6" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
    <Card variant="glass" title="Статусы" hoverable={false}>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={result.statusDistribution} dataKey="value" nameKey="name" outerRadius={90}>
              {result.statusDistribution.map((entry) => (
                <Cell key={entry.name} fill={entry.name === 'idle' ? '#94a3b8' : entry.name === 'moving' ? '#3b82f6' : '#10b981'} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
    <Card variant="glass" title="Загрузка грузовиков по часам" hoverable={false} className="xl:col-span-3">
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={result.truckLoadByHour}>
            <XAxis dataKey="hour" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip />
            <Bar dataKey="load" fill="#10b981" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  </div>
)
