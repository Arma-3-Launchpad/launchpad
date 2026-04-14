import { useEffect, useState } from 'react'
import { AppPreferencesDialog } from './components/AppPreferencesDialog'
import { Sidebar } from './components/Sidebar'
import { AppPreferencesProvider } from './context/AppPreferencesContext'
import { getElectronIpc } from './electronIpc'
import { HomePage } from './pages/HomePage'
import { MissionBuildPage } from './pages/MissionBuildPage'
import { MissionListPage } from './pages/MissionList'
import { SettingsPage } from './pages/SettingsPage'
import { TestingPage } from './pages/Testing'
import { LoggingPage } from './pages/Logging'
import './App.css'

type NavId = 'home' | 'mission' | 'managed-missions' | 'testing' | 'logging' | 'settings'

type MenuEventPayload = { event?: string }

export default function App() {
  const [page, setPage] = useState<NavId>('home')
  const [preferencesOpen, setPreferencesOpen] = useState(false)

  useEffect(() => {
    const ipc = getElectronIpc()
    if (!ipc) return
    const handler = (_evt: unknown, ...args: unknown[]) => {
      const payload = args[0] as MenuEventPayload | undefined
      if (payload?.event === 'preferences') {
        setPreferencesOpen(true)
      }
    }
    ipc.on('menu-event', handler)
    return () => {
      ipc.removeListener('menu-event', handler)
    }
  }, [])

  return (
    <AppPreferencesProvider>
      <div className="app-shell">
        <Sidebar
          active={page}
          onSelect={(id) => {
            setPage(id)
          }}
        />
        <div className="shell-main">
          <main className="shell-content" id="main">
            {page === 'home' && (
              <HomePage onGoMission={() => setPage('mission')} onGoSettings={() => setPage('settings')} />
            )}
            {page === 'settings' && <SettingsPage />}
            {page === 'mission' && <MissionBuildPage onGoSettings={() => setPage('settings')} />}
            {page === 'managed-missions' && (
              <MissionListPage onOpenSettings={() => setPage('settings')} />
            )}
            {page === 'testing' && <TestingPage />}
            {page === 'logging' && <LoggingPage />}
          </main>
        </div>
      </div>
      {preferencesOpen ? <AppPreferencesDialog onClose={() => setPreferencesOpen(false)} /> : null}
    </AppPreferencesProvider>
  )
}
