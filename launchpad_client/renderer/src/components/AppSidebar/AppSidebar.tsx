import { navGroups } from './navItems'
import { SidebarBrand } from './SidebarBrand'
import { SidebarFooter } from './SidebarFooter'
import { SidebarNav } from './SidebarNav'
import type { NavId } from './types'
import './AppSidebar.less'

type Props = {
  active: NavId
  onSelect: (id: NavId) => void
}

export function AppSidebar({ active, onSelect }: Props) {
  return (
    <aside className="app-sidebar" aria-label="Primary">
      <SidebarBrand />
      <SidebarNav groups={navGroups} active={active} onSelect={onSelect} />
      <SidebarFooter active={active} onSelect={onSelect} />
    </aside>
  )
}
