import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

export const Layout = () => (
  <div className="flex min-h-screen bg-surface-900 text-slate-100">
    <Sidebar />
    <div className="flex min-h-screen flex-1 flex-col">
      <Header />
      <main className="animate-fade-in p-6">
        <Outlet />
      </main>
    </div>
  </div>
)
