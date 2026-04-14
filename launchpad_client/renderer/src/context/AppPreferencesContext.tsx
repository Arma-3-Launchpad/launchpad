import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getElectronIpc } from '../electronIpc'

type AppSettingsFile = {
  use_syntax_highlighting: boolean
}

const defaults: AppSettingsFile = { use_syntax_highlighting: true }

const AppPreferencesContext = createContext<{
  useSyntaxHighlighting: boolean
  setUseSyntaxHighlighting: (value: boolean) => Promise<void>
  reload: () => Promise<void>
} | null>(null)

export function AppPreferencesProvider({ children }: { children: ReactNode }) {
  const [useSyntaxHighlighting, setLocal] = useState(defaults.use_syntax_highlighting)

  const reload = useCallback(async () => {
    const ipc = getElectronIpc()
    if (!ipc) {
      setLocal(defaults.use_syntax_highlighting)
      return
    }
    const res = (await ipc.invoke('getAppSettings')) as { contents?: Partial<AppSettingsFile> }
    const c = res?.contents
    if (c && typeof c.use_syntax_highlighting === 'boolean') {
      setLocal(c.use_syntax_highlighting)
    } else {
      setLocal(defaults.use_syntax_highlighting)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const setUseSyntaxHighlighting = useCallback(async (value: boolean) => {
    setLocal(value)
    const ipc = getElectronIpc()
    if (ipc) {
      await ipc.invoke('saveAppSettings', { settings: { use_syntax_highlighting: value } })
    }
  }, [])

  const value = useMemo(
    () => ({ useSyntaxHighlighting, setUseSyntaxHighlighting, reload }),
    [useSyntaxHighlighting, setUseSyntaxHighlighting, reload],
  )

  return <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>
}

export function useAppPreferences() {
  const ctx = useContext(AppPreferencesContext)
  if (!ctx) {
    throw new Error('useAppPreferences must be used within AppPreferencesProvider')
  }
  return ctx
}
