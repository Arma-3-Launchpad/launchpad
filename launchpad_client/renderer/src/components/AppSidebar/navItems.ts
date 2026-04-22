import {
  faHome,
  faFolderOpen,
  faCubes,
  faFlask,
  faBug,
  faScroll,
  faGear,
} from '@fortawesome/free-solid-svg-icons'
import type { NavGroup, NavItem } from './types'

export const navGroups: NavGroup[] = [
  {
    label: 'Main',
    items: [
      { id: 'home', label: 'Overview', hint: 'Status and quick links', icon: faHome },
    ],
  },
  {
    label: 'Projects',
    items: [
      { id: 'managed-missions', label: 'Missions', hint: 'View and create missions', icon: faFolderOpen },
      { id: 'managed-mod-projects', label: 'Mods', hint: 'Addon source folders', icon: faCubes },
    ],
  },
  {
    label: 'Development',
    items: [
      { id: 'testing', label: 'Testing', hint: 'Mods and Arma 3 test launch', icon: faFlask },
      { id: 'debugging', label: 'Debugging', hint: 'Companion socket and commands', icon: faBug },
      { id: 'logging', label: 'Logs', hint: 'Live RPT stream', icon: faScroll },
    ],
  },
]

export const settingsItem: NavItem = {
  id: 'settings',
  label: 'Settings',
  hint: 'Configure the application',
  icon: faGear,
}
