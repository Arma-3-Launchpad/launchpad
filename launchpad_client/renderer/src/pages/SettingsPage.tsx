import { useCallback, useEffect, useState } from 'react'
import {
  fetchSettings,
  type RemoteServerAuthKind,
  type RemoteServerSettingsEntry,
  updateSettings,
  type LaunchpadSettings,
} from '../api/launchpad'
import { FileFolderInput } from '../components/FileFolderInput'
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

/** Matches an empty form before any successful load (used so Save still works if load failed). */
const EMPTY_SETTINGS_BASELINE: LaunchpadSettings = {
  arma3_path: '',
  arma3_workshop_path: '',
  arma3_tools_path: '',
  arma3_profile_path: '',
  arma3_appdata_path: '',
  default_author: '',
  github_new_repo_visibility: 'private',
  remote_servers: [],
  logs_remote_default_server_id: '',
  logs_remote_default_folder: '/home/steam/arma3',
  hemtt_path: '',
}

function sameSettings(a: LaunchpadSettings, b: LaunchpadSettings) {
  const normServers = (rows: RemoteServerSettingsEntry[]) =>
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      host: r.host,
      port: r.port,
      username: r.username,
      auth: r.auth,
      keyPath: r.keyPath ?? '',
    }))
  return (
    a.arma3_path === b.arma3_path &&
    a.arma3_workshop_path === b.arma3_workshop_path &&
    a.arma3_tools_path === b.arma3_tools_path &&
    a.arma3_profile_path === b.arma3_profile_path &&
    a.arma3_appdata_path === b.arma3_appdata_path &&
    a.default_author === b.default_author &&
    a.github_new_repo_visibility === b.github_new_repo_visibility &&
    a.logs_remote_default_server_id === b.logs_remote_default_server_id &&
    a.logs_remote_default_folder === b.logs_remote_default_folder &&
    a.hemtt_path === b.hemtt_path &&
    JSON.stringify(normServers(a.remote_servers)) === JSON.stringify(normServers(b.remote_servers))
  )
}

function newRemoteServerId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `srv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function SettingsPage() {
  const [saved, setSaved] = useState<LaunchpadSettings | null>(null)
  const [arma3Path, setArma3Path] = useState('')
  const [arma3WorkshopPath, setArma3WorkshopPath] = useState('')
  const [toolsPath, setToolsPath] = useState('')
  const [profilePath, setProfilePath] = useState('')
  const [appdataPath, setAppdataPath] = useState('')
  const [defaultAuthor, setDefaultAuthor] = useState('')
  const [githubVisibility, setGithubVisibility] = useState<'public' | 'private'>('private')
  const [remoteServers, setRemoteServers] = useState<RemoteServerSettingsEntry[]>([])
  const [remoteDefaultServerId, setRemoteDefaultServerId] = useState('')
  const [remoteDefaultFolder, setRemoteDefaultFolder] = useState('/home/steam/arma3')
  const [hemttPath, setHemttPath] = useState('')
  const [serverDialogOpen, setServerDialogOpen] = useState(false)
  const [serverDialogMode, setServerDialogMode] = useState<'new' | 'edit'>('new')
  const [serverDialogId, setServerDialogId] = useState('')
  const [serverNameInput, setServerNameInput] = useState('')
  const [serverHostInput, setServerHostInput] = useState('')
  const [serverPortInput, setServerPortInput] = useState('22')
  const [serverUserInput, setServerUserInput] = useState('')
  const [serverAuthInput, setServerAuthInput] = useState<RemoteServerAuthKind>('password')
  const [serverKeyPathInput, setServerKeyPathInput] = useState('')
  const [serverDialogErr, setServerDialogErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveOk, setSaveOk] = useState(false)
  const [saving, setSaving] = useState(false)
  const [updateBusy, setUpdateBusy] = useState(false)
  const [installBusy, setInstallBusy] = useState(false)
  const [updateResult, setUpdateResult] = useState<CheckUpdatesResult | null>(null)
  const [detectBusy, setDetectBusy] = useState(false)
  const [detectMsg, setDetectMsg] = useState<string | null>(null)
  const [hemttInstallBusy, setHemttInstallBusy] = useState(false)
  const [hemttInstallMsg, setHemttInstallMsg] = useState<string | null>(null)

  const draft: LaunchpadSettings = {
    arma3_path: trimField(arma3Path),
    arma3_workshop_path: trimField(arma3WorkshopPath),
    arma3_tools_path: trimField(toolsPath),
    arma3_profile_path: trimField(profilePath),
    arma3_appdata_path: trimField(appdataPath),
    default_author: trimField(defaultAuthor),
    github_new_repo_visibility: githubVisibility,
    remote_servers: remoteServers,
    logs_remote_default_server_id: trimField(remoteDefaultServerId),
    logs_remote_default_folder: trimField(remoteDefaultFolder) || '/home/steam/arma3',
    hemtt_path: trimField(hemttPath),
  }

  const dirty = !sameSettings(draft, saved ?? EMPTY_SETTINGS_BASELINE)

  const hydrateFromSettings = useCallback((s: LaunchpadSettings) => {
    setSaved(s)
    setArma3Path(s.arma3_path ?? '')
    setToolsPath(s.arma3_tools_path ?? '')
    setProfilePath(s.arma3_profile_path ?? '')
    setAppdataPath(s.arma3_appdata_path ?? '')
    setDefaultAuthor(s.default_author ?? '')
    setGithubVisibility(s.github_new_repo_visibility === 'public' ? 'public' : 'private')
    setRemoteServers(Array.isArray(s.remote_servers) ? s.remote_servers : [])
    setRemoteDefaultServerId(s.logs_remote_default_server_id ?? '')
    setRemoteDefaultFolder(s.logs_remote_default_folder ?? '/home/steam/arma3')
    setHemttPath(s.hemtt_path ?? '')
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    setSaveOk(false)
    try {
      const s = await fetchSettings()
      hydrateFromSettings(s)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load settings')
      setSaved(null)
    } finally {
      setLoading(false)
    }
  }, [hydrateFromSettings])

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
        arma3_workshop_path: trimField(arma3WorkshopPath),
        arma3_tools_path: trimField(toolsPath),
        arma3_profile_path: trimField(profilePath),
        arma3_appdata_path: trimField(appdataPath),
        default_author: trimField(defaultAuthor),
        github_new_repo_visibility: githubVisibility,
        remote_servers: remoteServers,
        logs_remote_default_server_id: trimField(remoteDefaultServerId),
        logs_remote_default_folder: trimField(remoteDefaultFolder) || '/home/steam/arma3',
        hemtt_path: trimField(hemttPath),
      })
      if ('error' in res && res.error) {
        setSaveError(res.error)
        return
      }
      if (!res.ok) {
        setSaveError('Save failed')
        return
      }
      const { ok: _savedOk, ...nextSettings } = res
      hydrateFromSettings(nextSettings)
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

  async function openHemttUrl(url: string) {
    const ipc = getElectronIpc()
    if (ipc) {
      await ipc.invoke('openExternalUrl', url)
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function onInstallHemttWinget() {
    const ipc = getElectronIpc()
    if (!ipc) {
      setHemttInstallMsg('Use the desktop app to run the installer from here.')
      return
    }
    setHemttInstallBusy(true)
    setHemttInstallMsg(null)
    try {
      const raw = (await ipc.invoke('install-hemtt-winget')) as {
        ok?: boolean
        error?: string
        unsupported?: boolean
      }
      if (raw.unsupported) {
        setHemttInstallMsg('Use the installation steps link for your system.')
        return
      }
      if (raw.ok) {
        setHemttInstallMsg(
          'HEMTT is ready or already installed. Restart this app if mod builds still cannot find it.',
        )
        return
      }
      setHemttInstallMsg(raw.error ?? 'Install did not complete.')
    } catch {
      setHemttInstallMsg('Something went wrong.')
    } finally {
      setHemttInstallBusy(false)
    }
  }

  async function onDetectArmaPaths() {
    setDetectMsg(null)
    const ipc = getElectronIpc()
    if (!ipc) {
      setDetectMsg('Use the desktop app to find folders automatically.')
      return
    }
    setDetectBusy(true)
    try {
      const raw = (await ipc.invoke('detect-arma-paths')) as {
        ok?: boolean
        paths?: {
          arma3_path?: string
          arma3_tools_path?: string
          arma3_profile_path?: string
          arma3_appdata_path?: string
        }
      }
      if (!raw.ok || !raw.paths) {
        setDetectMsg('Something went wrong. Try again or pick folders above.')
        return
      }
      const p = raw.paths
      const detectedArma3 = trimField(p.arma3_path)
      const detectedTools = trimField(p.arma3_tools_path)
      const detectedProfile = trimField(p.arma3_profile_path)
      const detectedAppdata = trimField(p.arma3_appdata_path)
      let applied = 0
      if (detectedArma3) applied += 1
      if (detectedTools) applied += 1
      if (detectedProfile) applied += 1
      if (detectedAppdata) applied += 1
      setSaveOk(false)
      if (applied === 0) {
        setDetectMsg('No install found. Pick folders above.')
        return
      }
      setSaveError(null)
      const saveRes = await updateSettings({
        arma3_path: detectedArma3 || trimField(arma3Path),
        arma3_tools_path: detectedTools || trimField(toolsPath),
        arma3_profile_path: detectedProfile || trimField(profilePath),
        arma3_appdata_path: detectedAppdata || trimField(appdataPath),
        default_author: trimField(defaultAuthor),
        github_new_repo_visibility: githubVisibility,
        remote_servers: remoteServers,
        logs_remote_default_server_id: trimField(remoteDefaultServerId),
        logs_remote_default_folder: trimField(remoteDefaultFolder) || '/home/steam/arma3',
        hemtt_path: trimField(hemttPath),
      })
      if ('error' in saveRes && saveRes.error) {
        setDetectMsg(saveRes.error)
        return
      }
      if (!saveRes.ok) {
        setDetectMsg('Could not save. Try Save at the bottom of the page.')
        return
      }
      const { ok: _savedOk, ...nextSettings } = saveRes
      hydrateFromSettings(nextSettings)
      setSaveOk(true)
      setDetectMsg('Filled in paths we could find and saved them.')
    } catch {
      setDetectMsg('Something went wrong. Try again or pick folders above.')
    } finally {
      setDetectBusy(false)
    }
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
    setArma3WorkshopPath(saved.arma3_workshop_path ?? '')
    setToolsPath(saved.arma3_tools_path ?? '')
    setProfilePath(saved.arma3_profile_path ?? '')
    setAppdataPath(saved.arma3_appdata_path ?? '')
    setDefaultAuthor(saved.default_author ?? '')
    setGithubVisibility(saved.github_new_repo_visibility === 'public' ? 'public' : 'private')
    setRemoteServers(Array.isArray(saved.remote_servers) ? saved.remote_servers : [])
    setRemoteDefaultServerId(saved.logs_remote_default_server_id ?? '')
    setRemoteDefaultFolder(saved.logs_remote_default_folder ?? '/home/steam/arma3')
    setHemttPath(saved.hemtt_path ?? '')
    setSaveError(null)
    setSaveOk(false)
  }

  function openNewRemoteServerDialog() {
    setServerDialogMode('new')
    setServerDialogId('')
    setServerNameInput('')
    setServerHostInput('')
    setServerPortInput('22')
    setServerUserInput('')
    setServerAuthInput('password')
    setServerKeyPathInput('')
    setServerDialogErr(null)
    setServerDialogOpen(true)
  }

  function openEditRemoteServerDialog(row: RemoteServerSettingsEntry) {
    setServerDialogMode('edit')
    setServerDialogId(row.id)
    setServerNameInput(row.name)
    setServerHostInput(row.host)
    setServerPortInput(String(row.port || 22))
    setServerUserInput(row.username)
    setServerAuthInput(row.auth)
    setServerKeyPathInput(row.keyPath ?? '')
    setServerDialogErr(null)
    setServerDialogOpen(true)
  }

  function closeRemoteServerDialog() {
    setServerDialogOpen(false)
    setServerDialogErr(null)
  }

  function submitRemoteServerDialog() {
    const name = trimField(serverNameInput)
    const host = trimField(serverHostInput)
    const username = trimField(serverUserInput)
    const portRaw = Number.parseInt(trimField(serverPortInput), 10)
    const port = Number.isInteger(portRaw) && portRaw > 0 ? portRaw : 22
    if (!name) {
      setServerDialogErr('Server name is required.')
      return
    }
    if (!host) {
      setServerDialogErr('Host is required.')
      return
    }
    if (!username) {
      setServerDialogErr('Username is required.')
      return
    }
    if (serverAuthInput === 'key' && !trimField(serverKeyPathInput)) {
      setServerDialogErr('Key file path is required for key authentication.')
      return
    }
    const nextRow: RemoteServerSettingsEntry = {
      id: serverDialogMode === 'edit' && serverDialogId ? serverDialogId : newRemoteServerId(),
      name,
      host,
      port,
      username,
      auth: serverAuthInput,
      keyPath: serverAuthInput === 'key' ? trimField(serverKeyPathInput) : undefined,
    }
    setRemoteServers((prev) => {
      const exists = prev.some((x) => x.id === nextRow.id)
      if (exists) {
        return prev.map((x) => (x.id === nextRow.id ? nextRow : x))
      }
      return [...prev, nextRow]
    })
    setSaveOk(false)
    setServerDialogOpen(false)
  }

  function removeRemoteServer(id: string) {
    setRemoteServers((prev) => prev.filter((row) => row.id !== id))
    setRemoteDefaultServerId((cur) => (cur === id ? '' : cur))
    setSaveOk(false)
  }

  const isWindows =
    typeof navigator !== 'undefined' &&
    (/Win/i.test(navigator.platform) || /Windows/i.test(navigator.userAgent))
  const hemttDesktop = getElectronIpc() !== null

  return (
    <div className="page-stack">
      {/* <header className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-lead">
          Paths and preferences are saved locally on your computer. You can change them any time.
        </p>
      </header> */}

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

      <section className="card form-card" aria-labelledby="remote-servers-heading">
        <h2 id="remote-servers-heading" className="card-title">
          Remote servers
        </h2>
        <p className="card-body">
          Save SSH host details for remote log browsing. Passwords and passphrases are never saved and are requested
          when you connect. When you finish editing, use Save at the bottom of the page so everything is remembered.
        </p>
        {loading ? (
          <p className="card-body">Loading…</p>
        ) : (
          <>
            <label className="field">
              <span className="field-label">Default server for remote logs</span>
              <select
                className="field-input"
                value={remoteDefaultServerId}
                onChange={(e) => {
                  setRemoteDefaultServerId(e.target.value)
                  setSaveOk(false)
                }}
              >
                <option value="">None selected</option>
                {remoteServers.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name} ({row.username}@{row.host}:{row.port})
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Default remote logs folder</span>
              <input
                className="field-input"
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={remoteDefaultFolder}
                onChange={(e) => {
                  setRemoteDefaultFolder(e.target.value)
                  setSaveOk(false)
                }}
                placeholder="/home/steam/arma3"
              />
              <span className="field-hint">Used by the Logs page when Remote is selected.</span>
            </label>

            <div className="logging-meta-grid">
              {remoteServers.length === 0 ? (
                <p className="card-body">No remote servers saved yet.</p>
              ) : (
                remoteServers.map((row) => (
                  <div key={row.id} className="card" style={{ margin: 0 }}>
                    <p className="card-body" style={{ marginBottom: 8 }}>
                      <strong>{row.name}</strong> - {row.username}@{row.host}:{row.port}
                    </p>
                    <p className="field-hint" style={{ marginTop: 0 }}>
                      Auth: {row.auth === 'key' ? `Key file (${row.keyPath ?? 'path not set'})` : 'Username + password'}
                    </p>
                    <div className="form-actions">
                      <button type="button" className="btn btn-ghost" onClick={() => openEditRemoteServerDialog(row)}>
                        Edit
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => removeRemoteServer(row.id)}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-primary" onClick={openNewRemoteServerDialog}>
                Add remote server
              </button>
            </div>
          </>
        )}
      </section>

      <section className="card form-card" aria-labelledby="paths-heading">
        <h2 id="paths-heading" className="card-title">
          Arma 3 paths
        </h2>
        <p className="card-body">
          Looks for a Steam install, Tools next to the game, your most likely profile, and the usual log folder.
        </p>
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void onDetectArmaPaths()}
            disabled={detectBusy || loading}
          >
            {detectBusy ? 'Searching…' : 'Find folders'}
          </button>
        </div>
        {detectMsg ? (
          <p className="card-body" role="status">
            {detectMsg}
          </p>
        ) : null}
        {loading && <p className="card-body">Loading…</p>}

        {!loading && (
          <>
            <label className="field">
              <span className="field-label">Arma 3 installation folder</span>
              <FileFolderInput
                type="folder"
                commit="always"
                name="arma3_path"
                autoComplete="off"
                placeholder="e.g. C:\Program Files (x86)\Steam\steamapps\common\Arma 3"
                inputClassName="field-input"
                value={arma3Path}
                onChange={(v) => {
                  setArma3Path(v)
                  setSaveOk(false)
                }}
              />
              <span className="field-hint">Game root directory (contains arma3.exe).</span>
            </label>

            <label className="field">
              <span className="field-label">Arma 3 Tools folder</span>
              <FileFolderInput
                type="folder"
                commit="always"
                name="arma3_tools_path"
                autoComplete="off"
                placeholder="e.g. C:\Program Files (x86)\Steam\steamapps\common\Arma 3 Tools"
                inputClassName="field-input"
                value={toolsPath}
                onChange={(v) => {
                  setToolsPath(v)
                  setSaveOk(false)
                }}
              />
              <span className="field-hint">Steam “Arma 3 Tools” app folder, if you use it.</span>
            </label>

            <label className="field">
              <span className="field-label">Arma 3 profile folder</span>
              <FileFolderInput
                type="folder"
                commit="always"
                name="arma3_profile_path"
                autoComplete="off"
                placeholder="e.g. C:\Users\You\Documents\Arma 3 - Other Profiles\YourProfileName"
                inputClassName="field-input"
                value={profilePath}
                onChange={(v) => {
                  setProfilePath(v)
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
              <FileFolderInput
                type="folder"
                commit="always"
                name="arma3_appdata_path"
                autoComplete="off"
                placeholder="%LOCALAPPDATA%\Arma 3"
                inputClassName="field-input"
                value={appdataPath}
                onChange={(v) => {
                  setAppdataPath(v)
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

            <label className="field">
              <span className="field-label">HEMTT program (optional)</span>
              <span className="field-hint" style={{ display: 'block', marginBottom: 8 }}>
                Used when you build or check mod projects.{' '}
                <a href="https://hemtt.dev/#what-is-hemtt" target="_blank" rel="noopener noreferrer">
                  What is HEMTT?
                </a>
              </span>
              <div className="form-actions" style={{ flexWrap: 'wrap', marginBottom: 8 }}>
                {hemttDesktop && isWindows ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void onInstallHemttWinget()}
                    disabled={hemttInstallBusy}
                  >
                    {hemttInstallBusy ? 'Installing…' : 'Install with winget'}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => void openHemttUrl('https://hemtt.dev/installation/')}
                >
                  Installation steps
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    void openHemttUrl('https://github.com/BrettMayson/HEMTT/releases/latest')
                  }
                >
                  Downloads
                </button>
              </div>
              {hemttInstallMsg ? (
                <p className="card-body" role="status" style={{ marginTop: 0, marginBottom: 12 }}>
                  {hemttInstallMsg}
                </p>
              ) : null}
              <FileFolderInput
                type="file"
                commit="always"
                name="hemtt_path"
                autoComplete="off"
                placeholder="Leave empty if the installer set up HEMTT for you"
                inputClassName="field-input"
                value={hemttPath}
                onChange={(v) => {
                  setHemttPath(v)
                  setSaveOk(false)
                }}
              />
              <span className="field-hint">
                Leave empty unless the app cannot find HEMTT. Then choose the HEMTT program file (for example hemtt.exe on
                Windows).
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

      {serverDialogOpen ? (
        <div className="modal-root" role="dialog" aria-modal="true" aria-labelledby="remote-server-dialog-title">
          <button type="button" className="modal-backdrop" aria-label="Close dialog" onClick={closeRemoteServerDialog} />
          <div className="modal-dialog modal-dialog-wide mission-edit-dialog">
            <header className="mission-edit-header">
              <div className="mission-edit-header-main">
                <p className="mission-edit-eyebrow">Remote servers</p>
                <h2 id="remote-server-dialog-title" className="mission-edit-title">
                  {serverDialogMode === 'edit' ? 'Edit remote server' : 'Add remote server'}
                </h2>
              </div>
              <button type="button" className="mission-edit-close" onClick={closeRemoteServerDialog} aria-label="Close">
                <span aria-hidden>×</span>
              </button>
            </header>
            <div className="mission-edit-surface">
              <div className="mission-edit-section">
                <label className="field">
                  <span className="field-label">Name</span>
                  <input
                    type="text"
                    className="field-input"
                    value={serverNameInput}
                    onChange={(e) => setServerNameInput(e.target.value)}
                    autoComplete="off"
                  />
                </label>
                <label className="field">
                  <span className="field-label">Host</span>
                  <input
                    type="text"
                    className="field-input"
                    value={serverHostInput}
                    onChange={(e) => setServerHostInput(e.target.value)}
                    autoComplete="off"
                  />
                </label>
                <label className="field">
                  <span className="field-label">Port</span>
                  <input
                    type="number"
                    className="field-input"
                    min={1}
                    value={serverPortInput}
                    onChange={(e) => setServerPortInput(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Username</span>
                  <input
                    type="text"
                    className="field-input"
                    value={serverUserInput}
                    onChange={(e) => setServerUserInput(e.target.value)}
                    autoComplete="off"
                  />
                </label>
                <label className="field">
                  <span className="field-label">Authentication</span>
                  <select
                    className="field-input"
                    value={serverAuthInput}
                    onChange={(e) => setServerAuthInput(e.target.value === 'key' ? 'key' : 'password')}
                  >
                    <option value="password">Username + password</option>
                    <option value="key">Username + key file</option>
                  </select>
                </label>
                {serverAuthInput === 'key' ? (
                  <label className="field">
                    <span className="field-label">Private key file path</span>
                    <FileFolderInput
                      type="file"
                      commit="always"
                      autoComplete="off"
                      placeholder="e.g. C:\\Users\\You\\.ssh\\id_rsa"
                      inputClassName="field-input"
                      value={serverKeyPathInput}
                      onChange={(v) => setServerKeyPathInput(v)}
                    />
                  </label>
                ) : null}
                {serverDialogErr ? (
                  <p className="form-banner form-banner-error" role="alert">
                    {serverDialogErr}
                  </p>
                ) : null}
              </div>
            </div>
            <footer className="mission-edit-footer">
              <div className="mission-edit-footer-actions">
                <button type="button" className="btn btn-primary" onClick={submitRemoteServerDialog}>
                  Save server
                </button>
                <button type="button" className="btn btn-ghost" onClick={closeRemoteServerDialog}>
                  Cancel
                </button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  )
}
