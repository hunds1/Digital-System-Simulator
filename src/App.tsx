import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/layout/Layout.tsx'
import { ConstructorPage } from './pages/Constructor/ConstructorPage.tsx'
import { ResultsPage } from './pages/Results/ResultsPage.tsx'
import { SettingsPage } from './pages/Settings/SettingsPage.tsx'
import { SimulationPage } from './pages/Simulation/SimulationPage.tsx'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/constructor" replace />} />
        <Route path="/constructor" element={<ConstructorPage />} />
        <Route path="/simulation" element={<SimulationPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/results" element={<ResultsPage />} />
      </Route>
    </Routes>
  )
}

export default App
