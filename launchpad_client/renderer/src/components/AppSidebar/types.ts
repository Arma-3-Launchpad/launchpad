import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'

export type NavId =
  | 'home'
  | 'managed-missions'
  | 'managed-mod-projects'
  | 'testing'
  | 'debugging'
  | 'logging'
  | 'settings'

export type NavItem = {
  id: NavId
  label: string
  hint: string
  icon: IconDefinition
}

export type NavGroup = {
  label: string
  items: NavItem[]
}
