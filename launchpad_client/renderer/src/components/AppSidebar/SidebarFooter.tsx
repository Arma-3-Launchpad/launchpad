import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { getElectronIpc } from '../../electronIpc'
import { settingsItem } from './navItems'
import type { NavId } from './types'

type Props = {
  active: NavId
  onSelect: (id: NavId) => void
}

export function SidebarFooter({ active, onSelect }: Props) {
  const [version, setVersion] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    const ipc = getElectronIpc()
    if (!ipc) return
    void ipc
      .invoke('getAppVersion')
      .then((payload) => {
        if (cancelled) return
        const v = (payload as { version?: unknown })?.version
        if (typeof v === 'string' && v.trim()) {
          setVersion(v.trim())
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="sidebar-footer">
      <button
        type="button"
        className={`sidebar-nav-item sidebar-settings-item${active === 'settings' ? ' is-active' : ''}`}
        onClick={() => onSelect('settings')}
        aria-current={active === 'settings' ? 'page' : undefined}
      >
        <FontAwesomeIcon icon={settingsItem.icon} className="sidebar-nav-icon" />
        <div className="sidebar-nav-text">
          <span className="sidebar-nav-label">{settingsItem.label}</span>
          <span className="sidebar-nav-hint">{settingsItem.hint}</span>
        </div>
      </button>
      <div className="sidebar-version">
        {version ? `v${version}` : 'Launchpad'}
      </div>
    </div>
  )
}
