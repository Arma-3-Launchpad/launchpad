import { useCallback, useEffect, useState } from 'react'
import {
  fetchSettings,
  updateSettings,
  type LaunchpadSettings,
} from '../api/launchpad'
import { getElectronIpc } from '../electronIpc'

type CheckUpdatesOk = {
  ok: true
  current: string
  latest: string
  updateAvailable: boolean
  releasesUrl: string
  releaseTag: string
  canAutoInstall: boolean
}

type CheckUpdatesResult = CheckUpdatesOk | { ok: false; message?: string }

function trimField(v: string | undefined | null): string {
  return (v ?? '').trim()
}

function sameSettings(a: LaunchpadSettings, b: LaunchpadSettings) {
  return (
    a.arma3_path === b.arma3_path &&
    a.arma3_tools_path === b.arma3_tools_path &&
    a.arma3_profile_path === b.arma3_profile_path &&
    a.arma3_appdata_path === b.arma3_appdata_path &&
    a.default_author === b.default_author &&
    a.github_new_repo_visibility === b.github_new_repo_visibility
  )
}

export function SettingsPage() {
  const [saved, setSaved] = useState<LaunchpadSettings | null>(null)
  const [arma3Path, setArma3Path] = useState('')
  const [toolsPath, setToolsPath] = useState('')
  const [profilePath, setProfilePath] = useState('')
  const [appdataPath, setAppdataPath] = useState('')
  const [defaultAuthor, setDefaultAuthor] = useState('')
  const [githubVisibility, setGithubVisibility] = useState<'public' | 'private'>('private')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveOk, setSaveOk] = useState(false)
  const [saving, setSaving] = useState(false)
  const [updateBusy, setUpdateBusy] = useState(false)
  const [installBusy, setInstallBusy] = useState(false)
  const [updateResult, setUpdateResult] = useState<CheckUpdatesResult | null>(null)

  const draft: LaunchpadSettings = {
    arma3_path: trimField(arma3Path),
    arma3_tools_path: trimField(toolsPath),
    arma3_profile_path: trimField(profilePath),
    arma3_appdata_path: trimField(appdataPath),
    default_author: trimField(defaultAuthor),
    github_new_repo_visibility: githubVisibility,
  }

  const dirty = saved ? !sameSettings(draft, saved) : false

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    setSaveOk(false)
    try {
      const s = await fetchSettings()
      setSaved(s)
      setArma3Path(s.arma3_path ?? '')
      setToolsPath(s.arma3_tools_path ?? '')
      setProfilePath(s.arma3_profile_path ?? '')
      setAppdataPath(s.arma3_appdata_path ?? '')
      setDefaultAuthor(s.default_author ?? '')
      setGithubVisibility(s.github_new_repo_visibility === 'public' ? 'public' : 'private')
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load settings')
      setSaved(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function onSave() {
    setSaving(true)
    setSaveError(null)
    setSaveOk(false)
    try {
      const res = await updateSettings({
        arma3_path: trimField(arma3Path),
        arma3_tools_path: trimField(toolsPath),
        arma3_profile_path: trimField(profilePath),
        arma3_appdata_path: trimField(appdataPath),
        default_author: trimField(defaultAuthor),
        github_new_repo_visibility: githubVisibility,
      })
      if ('error' in res && res.error) {
        setSaveError(res.error)
        return
      }
      if (!res.ok) {
        setSaveError('Save failed')
        return
      }
      setSaved({
        arma3_path: res.arma3_path ?? '',
        arma3_tools_path: res.arma3_tools_path ?? '',
        arma3_profile_path: res.arma3_profile_path ?? '',
        arma3_appdata_path: res.arma3_appdata_path ?? '',
        default_author: res.default_author ?? '',
        github_new_repo_visibility: res.github_new_repo_visibility === 'public' ? 'public' : 'private',
      })
      setArma3Path(res.arma3_path ?? '')
      setToolsPath(res.arma3_tools_path ?? '')
      setProfilePath(res.arma3_profile_path ?? '')
      setAppdataPath(res.arma3_appdata_path ?? '')
      setDefaultAuthor(res.default_author ?? '')
      setGithubVisibility(res.github_new_repo_visibility === 'public' ? 'public' : 'private')
      setSaveOk(true)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function onCheckForUpdates() {
    setUpdateBusy(true)
    setUpdateResult(null)
    try {
      const ipc = getElectronIpc()
      if (!ipc) {
        setUpdateResult({ ok: false, message: 'Updates can be checked from the desktop app.' })
        return
      }
      const raw = (await ipc.invoke('checkForUpdates')) as CheckUpdatesResult
      setUpdateResult(raw)
    } catch {
      setUpdateResult({ ok: false, message: 'Something went wrong while checking.' })
    } finally {
      setUpdateBusy(false)
    }
  }

  async function onOpenDownloads() {
    const ipc = getElectronIpc()
    if (!ipc || !updateResult || updateResult.ok !== true) return
    await ipc.invoke('openExternalUrl', updateResult.releasesUrl)
  }

  async function onInstallUpdate() {
    const ipc = getElectronIpc()
    if (!ipc || !updateResult || updateResult.ok !== true || !updateResult.updateAvailable) return
    setInstallBusy(true)
    try {
      const raw = (await ipc.invoke('installUpdate', { releaseTag: updateResult.releaseTag })) as
        | { ok: true }
        | { ok: false; message?: string }
      if (!raw.ok && 'message' in raw && raw.message) {
        setUpdateResult({ ok: false, message: raw.message as string })
      }
    } catch {
      setUpdateResult({
        ok: false,
        message: 'Could not install the update from here. Try the downloads page instead.',
      })
    } finally {
      setInstallBusy(false)
    }
  }

  function onDiscard() {
    if (!saved) return
    setArma3Path(saved.arma3_path ?? '')
    setToolsPath(saved.arma3_tools_path ?? '')
    setProfilePath(saved.arma3_profile_path ?? '')
    setAppdataPath(saved.arma3_appdata_path ?? '')
    setDefaultAuthor(saved.default_author ?? '')
    setGithubVisibility(saved.github_new_repo_visibility === 'public' ? 'public' : 'private')
    setSaveError(null)
    setSaveOk(false)
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-lead">
          Paths and preferences are saved locally on your computer. You can change them any time.
        </p>
      </header>

      <section className="card form-card" aria-labelledby="updates-heading">
        <h2 id="updates-heading" className="card-title">
          Updates
        </h2>
        <p className="card-body">
          See whether a newer version is available. If you installed with the Windows setup program, you can install
          updates from here when one is ready.
        </p>
        <div className="form-actions">
          <button
            type="button"
            className={
              updateResult?.ok === true && updateResult.updateAvailable && updateResult.canAutoInstall
                ? 'btn btn-ghost'
                : 'btn btn-primary'
            }
            onClick={() => void onCheckForUpdates()}
            disabled={updateBusy || installBusy}
          >
            {updateBusy ? 'Checking…' : 'Check for updates'}
          </button>
          {updateResult?.ok === true && updateResult.updateAvailable && updateResult.canAutoInstall && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void onInstallUpdate()}
              disabled={installBusy}
            >
              {installBusy ? 'Installing…' : 'Install update'}
            </button>
          )}
          {updateResult?.ok === true && updateResult.updateAvailable && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void onOpenDownloads()}
              disabled={installBusy}
            >
              Open downloads
            </button>
          )}
        </div>
        {updateResult?.ok === true && !updateResult.updateAvailable && (
          <p className="card-body" role="status">
            You are on the latest version ({updateResult.current}).
          </p>
        )}
        {updateResult?.ok === true && updateResult.updateAvailable && (
          <p className="card-body" role="status">
            A newer version is available ({updateResult.latest}). Your version is {updateResult.current}.
            {!updateResult.canAutoInstall && (
              <>
                {' '}
                Use the downloads page to get the installer, or install with the Windows setup program to enable updates
                from Settings.
              </>
            )}
          </p>
        )}
        {updateResult?.ok === false && updateResult.message && (
          <p className="form-banner form-banner-error" role="alert">
            {updateResult.message}
          </p>
        )}
      </section>

      {loadError && (
        <p className="form-banner form-banner-error" role="alert">
          {loadError}
        </p>
      )}
      {saveError && (
        <p className="form-banner form-banner-error" role="alert">
          {saveError}
        </p>
      )}
      {saveOk && !dirty && (
        <p className="form-banner form-banner-success" role="status">
          Settings saved.
        </p>
      )}

      <section className="card form-card" aria-labelledby="paths-heading">
        <h2 id="paths-heading" className="card-title">
          Arma 3 paths
        </h2>
        {loading && <p className="card-body">Loading…</p>}

        {!loading && (
          <>
            <label className="field">
              <span className="field-label">Arma 3 installation folder</span>
              <input
                className="field-input"
                name="arma3_path"
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="e.g. C:\Program Files (x86)\Steam\steamapps\common\Arma 3"
                value={arma3Path}
                onChange={(e) => {
                  setArma3Path(e.target.value)
                  setSaveOk(false)
                }}
              />
              <span className="field-hint">Game root directory (contains arma3.exe).</span>
            </label>

            <label className="field">
              <span className="field-label">Arma 3 Tools folder</span>
              <input
                className="field-input"
                name="arma3_tools_path"
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="e.g. C:\Program Files (x86)\Steam\steamapps\common\Arma 3 Tools"
                value={toolsPath}
                onChange={(e) => {
                  setToolsPath(e.target.value)
                  setSaveOk(false)
                }}
              />
              <span className="field-hint">Steam “Arma 3 Tools” app folder, if you use it.</span>
            </label>

            <label className="field">
              <span className="field-label">Arma 3 profile folder</span>
              <input
                className="field-input"
                name="arma3_profile_path"
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="e.g. C:\Users\You\Documents\Arma 3 - Other Profiles\YourProfileName"
                value={profilePath}
                onChange={(e) => {
                  setProfilePath(e.target.value)
                  setSaveOk(false)
                }}
              />
              <span className="field-hint">
                Required for new Missions: the folder that contains <span className="shell-inline-code">missions</span>{' '}
                and <span className="shell-inline-code">mpmissions</span> (where the launcher creates the scenario
                symlink).
              </span>
            </label>

            <label className="field">
              <span className="field-label">Arma 3 Local AppData folder</span>
              <input
                className="field-input"
                name="arma3_appdata_path"
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="%LOCALAPPDATA%\Arma 3"
                value={appdataPath}
                onChange={(e) => {
                  setAppdataPath(e.target.value)
                  setSaveOk(false)
                }}
              />
              <span className="field-hint">
                Typical Windows location:{' '}
                <span className="shell-inline-code">%LOCALAPPDATA%\Arma 3</span> (logs, BattlEye, launcher cache,
                etc.). This is not the same as the Documents “Other Profiles” folder above.
              </span>
            </label>

            <label className="field">
              <span className="field-label">Default author</span>
              <input
                className="field-input"
                name="default_author"
                type="text"
                autoComplete="name"
                spellCheck={false}
                placeholder="Your name or team"
                value={defaultAuthor}
                onChange={(e) => {
                  setDefaultAuthor(e.target.value)
                  setSaveOk(false)
                }}
              />
              <span className="field-hint">
                Prefills the Author field on New Mission. If you leave Author empty there, this value is still used for
                the build.
              </span>
            </label>

            <label className="field">
              <span className="field-label">Default GitHub repository visibility</span>
              <select
                className="field-input"
                name="github_new_repo_visibility"
                value={githubVisibility}
                onChange={(e) => {
                  setGithubVisibility(e.target.value === 'public' ? 'public' : 'private')
                  setSaveOk(false)
                }}
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
              <span className="field-hint">
                Used when you publish a mission from Managed Missions → GitHub (GitHub CLI). You can still override per
                publish in that dialog.
              </span>
            </label>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void onSave()}
                disabled={saving || !dirty}
              >
                Save
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onDiscard}
                disabled={saving || !dirty || !saved}
              >
                Discard changes
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void load()}
                disabled={saving || loading}
              >
                Reload from disk
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
