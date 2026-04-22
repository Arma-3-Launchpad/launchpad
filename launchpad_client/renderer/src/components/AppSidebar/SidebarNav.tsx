import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { NavId, NavGroup } from './types'

type Props = {
  groups: NavGroup[]
  active: NavId
  onSelect: (id: NavId) => void
}

export function SidebarNav({ groups, active, onSelect }: Props) {
  return (
    <nav className="sidebar-nav" aria-label="Sections">
      {groups.map((group) => (
        <div key={group.label} className="sidebar-nav-group">
          <div className="sidebar-nav-group-label">{group.label}</div>
          {group.items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`sidebar-nav-item${active === item.id ? ' is-active' : ''}`}
              onClick={() => onSelect(item.id)}
              aria-current={active === item.id ? 'page' : undefined}
            >
              <FontAwesomeIcon icon={item.icon} className="sidebar-nav-icon" />
              <div className="sidebar-nav-text">
                <span className="sidebar-nav-label">{item.label}</span>
                <span className="sidebar-nav-hint">{item.hint}</span>
              </div>
            </button>
          ))}
        </div>
      ))}
    </nav>
  )
}
