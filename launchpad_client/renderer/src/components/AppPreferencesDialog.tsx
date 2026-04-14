import { useEffect } from 'react'
import { useAppPreferences } from '../context/AppPreferencesContext'

export type AppPreferencesDialogProps = {
  onClose: () => void
}

export function AppPreferencesDialog({ onClose }: AppPreferencesDialogProps) {
  const { useSyntaxHighlighting, setUseSyntaxHighlighting, reload } = useAppPreferences()

  useEffect(() => {
    void reload()
  }, [reload])

  return (
    <div className="modal-root" role="dialog" aria-modal="true" aria-labelledby="app-prefs-title">
      <button type="button" className="modal-backdrop" aria-label="Close dialog" onClick={onClose} />
      <div className="modal-dialog">
        <h2 id="app-prefs-title" className="card-title">
          Preferences
        </h2>
        <label className="modal-checkbox-field">
          <input
            type="checkbox"
            checked={useSyntaxHighlighting}
            onChange={(e) => void setUseSyntaxHighlighting(e.target.checked)}
          />
          <span>Use color highlighting in the mission file editor</span>
        </label>
        <div className="modal-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
