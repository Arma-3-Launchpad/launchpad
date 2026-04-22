import { MissionBuildPage } from '../../pages/MissionBuildPage'

type CreateMissionModalProps = {
  onClose: () => void
  onOpenSettings?: () => void
  onCreated: (res: { mission_path?: string; mission_id?: string }) => void
}

export function CreateMissionModal({ onClose, onOpenSettings, onCreated }: CreateMissionModalProps) {
  return (
    <div className="modal-root" role="dialog" aria-modal="true" aria-labelledby="new-mission-title">
      <button
        type="button"
        className="modal-backdrop"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div className="modal-dialog modal-dialog-wide mission-edit-dialog">
        <header className="mission-edit-header">
          <div className="mission-edit-header-main">
            <p className="mission-edit-eyebrow">Create mission</p>
            <h2 id="new-mission-title" className="mission-edit-title">
              New Mission
            </h2>
          </div>
          <button
            type="button"
            className="mission-edit-close"
            onClick={onClose}
            aria-label="Close"
          >
            <span aria-hidden>×</span>
          </button>
        </header>
        <div className="mission-edit-surface">
          <MissionBuildPage
            embedded
            onGoSettings={onOpenSettings}
            onBuilt={(res) => {
              onClose()
              onCreated(res)
            }}
          />
        </div>
      </div>
    </div>
  )
}
