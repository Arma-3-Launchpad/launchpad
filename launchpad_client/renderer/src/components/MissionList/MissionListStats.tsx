type MissionListStatsProps = {
  total: number
  visible: number
  hasFilter: boolean
}

export function MissionListStats({ total, visible, hasFilter }: MissionListStatsProps) {
  if (total === 0) return null
  const missionWord = total === 1 ? 'mission' : 'missions'
  if (!hasFilter) {
    return (
      <p className="mission-list-stats" aria-live="polite">
        {total} {missionWord}
      </p>
    )
  }
  return (
    <p className="mission-list-stats" aria-live="polite">
      Showing {visible} of {total} {missionWord}
    </p>
  )
}
