import { useState } from 'react'
import { deleteManagedScenario, type ManagedScenario } from '../../api/launchpad'
import { fullMissionName } from './missionUtils'

type DeleteMissionModalProps = {
  mission: ManagedScenario
  onClose: () => void
  onDeleted: () => void
}

export function DeleteMissionModal({ mission, onClose, onDeleted }: DeleteMissionModalProps) {
  const [removeDisk, setRemoveDisk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleClose() {
    if (busy) return
    onClose()
  }

  async function handleConfirm() {
    setBusy(true)
    setError(null)
    try {
      await deleteManagedScenario(mission.id, { deleteProjectFiles: removeDisk })
      onDeleted()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-root" role="dialog" aria-modal="true" aria-labelledby="delete-mission-title">
      <button
        type="button"
        className="modal-backdrop"
        aria-label="Close dialog"
        onClick={handleClose}
        disabled={busy}
      />
      <div className="modal-dialog">
        <h2 id="delete-mission-title" className="card-title">
          Delete mission
        </h2>
        <p className="card-body" style={{ margin: 0, fontSize: 13 }}>
          Remove <strong>{fullMissionName(mission)}</strong> from Launchpad&apos;s managed list.
          {mission.project_path?.trim() ? (
            <> This does not delete files on disk unless you choose the option below.</>
          ) : (
            <> This mission has no project folder on record.</>
          )}
        </p>
        {mission.project_path?.trim() ? (
          <label className="modal-checkbox-field">
            <input
              type="checkbox"
              checked={removeDisk}
              onChange={(ev) => setRemoveDisk(ev.target.checked)}
              disabled={busy}
            />
            <span>
              Also delete the mission project folder from disk. Only folders under Launchpad&apos;s{' '}
              <code className="shell-inline-code">mission_projects</code> directory can be removed this way.
            </span>
          </label>
        ) : null}
        {error ? (
          <p className="form-banner form-banner-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void handleConfirm()}
          >
            {busy ? 'Deleting…' : 'Delete'}
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={handleClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
