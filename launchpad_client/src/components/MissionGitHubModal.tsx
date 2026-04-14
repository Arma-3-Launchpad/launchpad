import { useCallback, useEffect, useState } from 'react'
import {
  fetchMissionGitLog,
  fetchMissionGitStatus,
  postMissionGitCommit,
  postMissionGitInit,
  postMissionGitPublish,
  suggestGithubRepoSlug,
  type GitLogCommit,
  type GitStatusFile,
  type ManagedScenario,
  type MissionGitRoot,
} from '../api/launchpad'

export type MissionGitHubModalProps = {
  mission: ManagedScenario
  onClose: () => void
  /** Called after a successful commit so the parent can refresh mission data. */
  onAfterCommit?: () => void
  /** Open app Settings (e.g. default publish visibility). */
  onOpenSettings?: () => void
}

function shortHash(h: string) {
  return h.length > 7 ? h.slice(0, 7) : h
}

function fullMissionLabel(m: ManagedScenario) {
  const base = (m.name ?? '').trim()
  const suf = (m.map_suffix ?? '').trim()
  if (!base && !suf) return '—'
  return `${base || '—'}.${suf || '—'}`
}

export function MissionGitHubModal({ mission, onClose, onAfterCommit, onOpenSettings }: MissionGitHubModalProps) {
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [statusLoading, setStatusLoading] = useState(true)
  const [missionGitRoot, setMissionGitRoot] = useState<MissionGitRoot>('none')
  const [detectedToplevel, setDetectedToplevel] = useState<string | null>(null)
  const [branch, setBranch] = useState('')
  const [upstream, setUpstream] = useState<string | null>(null)
  const [hasMissionRepo, setHasMissionRepo] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [files, setFiles] = useState<GitStatusFile[]>([])
  const [commits, setCommits] = useState<GitLogCommit[]>([])
  const [commitMsg, setCommitMsg] = useState('')
  const [commitErr, setCommitErr] = useState<string | null>(null)
  const [commitOk, setCommitOk] = useState<string | null>(null)
  const [initErr, setInitErr] = useState<string | null>(null)
  const [initOk, setInitOk] = useState<string | null>(null)
  const [publishRepoName, setPublishRepoName] = useState('')
  const [publishVisibility, setPublishVisibility] = useState<'public' | 'private'>('private')
  const [publishDescription, setPublishDescription] = useState('')
  const [publishErr, setPublishErr] = useState<string | null>(null)
  const [publishOk, setPublishOk] = useState<string | null>(null)
  const [hasGhCli, setHasGhCli] = useState(false)
  const [ghAuthenticated, setGhAuthenticated] = useState(false)
  const [originUrl, setOriginUrl] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoadErr(null)
    setCommitErr(null)
    setCommitOk(null)
    setInitErr(null)
    setInitOk(null)
    setPublishErr(null)
    setPublishOk(null)
    setStatusLoading(true)
    try {
      const st = await fetchMissionGitStatus(mission.id)
      if (!st.ok && st.error) {
        setLoadErr(st.error)
        setHasMissionRepo(false)
        setMissionGitRoot('none')
        setFiles([])
        setCommits([])
        setStatusMessage(null)
        setDetectedToplevel(null)
        setOriginUrl(null)
        return
      }
      const root = (st.missionGitRoot ?? (st.hasMissionRepo ? 'mission' : st.hasGit ? 'mission' : 'none')) as MissionGitRoot
      setMissionGitRoot(root === 'parent' || root === 'mission' || root === 'none' ? root : 'none')
      const hm = Boolean(st.hasMissionRepo ?? st.hasGit)
      setHasMissionRepo(hm)
      setStatusMessage(st.message ?? null)
      setDetectedToplevel(
        typeof st.detectedGitToplevel === 'string' && st.detectedGitToplevel ? st.detectedGitToplevel : null,
      )
      setBranch(st.branch ?? '')
      setUpstream(st.upstream ?? null)
      setFiles(Array.isArray(st.files) ? st.files : [])
      setHasGhCli(Boolean(st.hasGhCli))
      setGhAuthenticated(Boolean(st.ghAuthenticated))
      setOriginUrl(typeof st.originUrl === 'string' && st.originUrl.trim() ? st.originUrl.trim() : null)

      const sug = st.suggestedRepoName ?? suggestGithubRepoSlug(mission.name ?? '', mission.map_suffix ?? '')
      setPublishRepoName((prev) => (prev.trim() ? prev : sug))
      const dv = st.defaultPublishVisibility === 'public' || st.defaultPublishVisibility === 'private' ? st.defaultPublishVisibility : 'private'
      setPublishVisibility(dv)
      setPublishDescription((prev) => {
        if (prev.trim()) return prev
        const d = (mission.description ?? '').trim()
        return d || `Arma 3 mission: ${fullMissionLabel(mission)}`
      })

      if (hm) {
        const lg = await fetchMissionGitLog(mission.id, 35)
        if (!lg.ok && lg.error) {
          setLoadErr(lg.error)
          setCommits([])
        } else {
          setCommits(Array.isArray(lg.commits) ? lg.commits : [])
        }
      } else {
        setCommits([])
      }
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Failed to load')
      setHasMissionRepo(false)
      setMissionGitRoot('none')
      setFiles([])
      setCommits([])
    } finally {
      setStatusLoading(false)
    }
  }, [mission.description, mission.id, mission.map_suffix, mission.name])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function doInit() {
    setInitErr(null)
    setInitOk(null)
    setBusy(true)
    try {
      const res = await postMissionGitInit(mission.id)
      if (!res.ok) {
        setInitErr(res.error ?? 'Init failed')
        return
      }
      setInitOk(res.message ?? 'Repository ready.')
      await refresh()
    } catch (e) {
      setInitErr(e instanceof Error ? e.message : 'Init failed')
    } finally {
      setBusy(false)
    }
  }

  async function doCommit() {
    setCommitErr(null)
    setCommitOk(null)
    setBusy(true)
    try {
      const res = await postMissionGitCommit(mission.id, commitMsg)
      if (!res.ok) {
        setCommitErr(res.error ?? 'Commit failed')
        return
      }
      setCommitMsg('')
      const line = (res.summary ?? '').split('\n').find((s) => s.trim())?.trim()
      setCommitOk(line ?? 'Committed.')
      onAfterCommit?.()
      await refresh()
    } catch (e) {
      setCommitErr(e instanceof Error ? e.message : 'Commit failed')
    } finally {
      setBusy(false)
    }
  }

  async function doPublish() {
    setPublishErr(null)
    setPublishOk(null)
    setBusy(true)
    try {
      const res = await postMissionGitPublish(mission.id, {
        repo_name: publishRepoName.trim(),
        visibility: publishVisibility,
        description: publishDescription.trim() || undefined,
      })
      if (!res.ok) {
        setPublishErr(res.error ?? 'Publish failed')
        return
      }
      setPublishOk(res.summary ?? (res.originUrl ? `Remote: ${res.originUrl}` : 'Published.'))
      await refresh()
    } catch (e) {
      setPublishErr(e instanceof Error ? e.message : 'Publish failed')
    } finally {
      setBusy(false)
    }
  }

  const title = fullMissionLabel(mission)
  const dirtyCount = files.length
  const showWorkbench = hasMissionRepo && !statusLoading
  const showPublishForm = hasMissionRepo && !originUrl && hasGhCli && ghAuthenticated

  return (
    <div className="modal-root" role="dialog" aria-modal="true" aria-labelledby="mission-github-title">
      <button type="button" className="modal-backdrop" aria-label="Close dialog" onClick={() => onClose()} />
      <div className="modal-dialog modal-dialog-wide mission-edit-dialog mission-github-dialog">
        <header className="mission-edit-header">
          <div className="mission-edit-header-main">
            <p className="mission-edit-eyebrow">GitHub</p>
            <h2 id="mission-github-title" className="mission-edit-title">
              {title}
            </h2>
            <div className="mission-edit-meta" aria-label="Repository summary">
              {statusLoading ? (
                <span className="mission-edit-pill">Loading…</span>
              ) : hasMissionRepo ? (
                <>
                  <span className="mission-edit-pill mission-edit-pill-accent">{branch || '—'}</span>
                  {upstream ? (
                    <span className="mission-edit-pill" title="Upstream tracking branch">
                      {upstream}
                    </span>
                  ) : null}
                  <span className="mission-edit-pill">
                    {dirtyCount === 0 ? 'Clean' : `${dirtyCount} change${dirtyCount === 1 ? '' : 's'}`}
                  </span>
                  {originUrl ? (
                    <span className="mission-edit-pill mission-edit-pill-on" title="origin remote">
                      Published
                    </span>
                  ) : null}
                </>
              ) : missionGitRoot === 'parent' ? (
                <span className="mission-edit-pill">Parent repo detected</span>
              ) : (
                <span className="mission-edit-pill">No mission repo</span>
              )}
            </div>
          </div>
          <button type="button" className="mission-edit-close" onClick={() => onClose()} aria-label="Close">
            <span aria-hidden>×</span>
          </button>
        </header>

        <div className="mission-edit-surface mission-github-surface mission-github-stack">
          {loadErr ? (
            <p className="mission-edit-banner form-banner form-banner-error" role="alert">
              {loadErr}
            </p>
          ) : null}

          {statusLoading ? (
            <div className="mission-github-loading">
              <div className="mission-resource-loading-bar" />
              <p className="mission-resource-loading-text">Scanning this mission folder…</p>
            </div>
          ) : (
            <>
              {!hasMissionRepo ? (
                <section className="mission-github-card">
                  <h3 className="mission-github-card-title">1 · Local repository</h3>
                  <p className="mission-github-card-text">
                    {missionGitRoot === 'parent' && detectedToplevel ? (
                      <>
                        Git is using a <strong>parent</strong> folder as the repository root (
                        <code className="mission-edit-code">{detectedToplevel}</code>), not this mission directory. To
                        track and commit mission files here, create a dedicated repository inside this folder.
                      </>
                    ) : (
                      <>
                        This mission folder is not its own Git repository yet. Create one here so history and commits
                        stay with the mission.
                      </>
                    )}
                  </p>
                  {statusMessage && missionGitRoot !== 'parent' ? (
                    <p className="mission-github-card-note">{statusMessage}</p>
                  ) : null}
                  {initErr ? (
                    <p className="form-banner form-banner-error" role="alert">
                      {initErr}
                    </p>
                  ) : null}
                  {initOk ? (
                    <p className="form-banner form-banner-success" role="status">
                      {initOk}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => void doInit()}
                  >
                    {busy ? 'Working…' : 'Create repository in mission folder'}
                  </button>
                  <p className="field-hint mission-github-hint">
                    Runs <code className="mission-edit-code">git init</code> in the mission project path only.
                  </p>
                </section>
              ) : null}

              {hasMissionRepo ? (
                <section className="mission-github-card">
                  <h3 className="mission-github-card-title">2 · Publish to GitHub</h3>
                  {originUrl ? (
                    <p className="mission-github-card-text">
                      Remote <code className="mission-edit-code">origin</code> is set.{' '}
                      <a className="mission-github-link" href={originUrl} target="_blank" rel="noreferrer">
                        {originUrl}
                      </a>
                    </p>
                  ) : !hasGhCli ? (
                    <p className="mission-github-card-text">
                      Install the{' '}
                      <a
                        className="mission-github-link"
                        href="https://cli.github.com/"
                        target="_blank"
                        rel="noreferrer"
                      >
                        GitHub CLI
                      </a>{' '}
                      (<code className="mission-edit-code">gh</code>) and authenticate with{' '}
                      <code className="mission-edit-code">gh auth login</code> to create a repository from this panel.
                    </p>
                  ) : !ghAuthenticated ? (
                    <p className="mission-github-card-text">
                      Sign in to GitHub from a terminal in any folder:{' '}
                      <code className="mission-edit-code">gh auth login</code>
                    </p>
                  ) : (
                    <>
                      <p className="mission-github-card-text">
                        Creates a new GitHub repository under your account, adds <code className="mission-edit-code">origin</code>, and pushes. Default visibility comes from{' '}
                        <strong>Settings</strong>
                        {onOpenSettings ? (
                          <>
                            {' '}
                            (<button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpenSettings()}>
                              open
                            </button>
                            ).
                          </>
                        ) : (
                          ' (sidebar).'
                        )}
                      </p>
                      {publishErr ? (
                        <p className="form-banner form-banner-error" role="alert">
                          {publishErr}
                        </p>
                      ) : null}
                      {publishOk ? (
                        <p className="form-banner form-banner-success" role="status">
                          {publishOk}
                        </p>
                      ) : null}
                      {showPublishForm ? (
                        <div className="mission-github-publish-fields">
                          <label className="field">
                            <span className="field-label">Repository name</span>
                            <input
                              type="text"
                              className="field-input"
                              autoComplete="off"
                              spellCheck={false}
                              value={publishRepoName}
                              onChange={(ev) => setPublishRepoName(ev.target.value)}
                              disabled={busy}
                            />
                          </label>
                          <label className="field">
                            <span className="field-label">Visibility</span>
                            <select
                              className="field-input"
                              value={publishVisibility}
                              onChange={(ev) =>
                                setPublishVisibility(ev.target.value === 'public' ? 'public' : 'private')
                              }
                              disabled={busy}
                            >
                              <option value="private">Private</option>
                              <option value="public">Public</option>
                            </select>
                          </label>
                          <label className="field">
                            <span className="field-label">Description</span>
                            <input
                              type="text"
                              className="field-input"
                              value={publishDescription}
                              onChange={(ev) => setPublishDescription(ev.target.value)}
                              disabled={busy}
                            />
                          </label>
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={busy || !publishRepoName.trim()}
                            onClick={() => void doPublish()}
                          >
                            {busy ? 'Publishing…' : 'Create on GitHub and push'}
                          </button>
                        </div>
                      ) : null}
                    </>
                  )}
                </section>
              ) : null}

              {showWorkbench ? (
                <div className="mission-github-layout">
                  <aside className="mission-github-sidebar">
                    <div className="mission-resource-sidebar-head">
                      <span className="mission-resource-sidebar-title">Recent commits</span>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void refresh()}>
                        Refresh
                      </button>
                    </div>
                    <div className="mission-github-commit-list">
                      {commits.length === 0 ? (
                        <p className="mission-github-empty-list">No commits yet.</p>
                      ) : (
                        <ul className="mission-github-commits">
                          {commits.map((c) => (
                            <li key={c.hash} className="mission-github-commit-row">
                              <code className="mission-github-hash" title={c.hash}>
                                {shortHash(c.hash)}
                              </code>
                              <div className="mission-github-commit-body">
                                <div className="mission-github-subject">{c.subject || '—'}</div>
                                <div className="mission-github-meta">
                                  {c.author} · {c.date}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </aside>
                  <section className="mission-github-main">
                    <div className="mission-resource-editor-head">
                      <h3 className="mission-resource-editor-title">3 · Local changes</h3>
                    </div>
                    <div className="mission-github-changes-body">
                      {files.length === 0 ? (
                        <p className="mission-github-placeholder">Working tree matches the last commit.</p>
                      ) : (
                        <ul className="mission-github-files">
                          {files.map((f) => (
                            <li key={`${f.code}:${f.path}`} className="mission-github-file-row">
                              <span className="mission-github-code" title="Git status code">
                                {f.code || '—'}
                              </span>
                              <span className="mission-github-path">{f.path}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      <label className="field mission-github-commit-field">
                        <span className="field-label">Commit message</span>
                        <textarea
                          className="field-input mission-github-commit-msg"
                          value={commitMsg}
                          onChange={(ev) => setCommitMsg(ev.target.value)}
                          disabled={busy}
                          rows={3}
                          placeholder="Describe your changes"
                          spellCheck={true}
                        />
                      </label>
                      {commitErr ? (
                        <p className="form-banner form-banner-error" role="alert">
                          {commitErr}
                        </p>
                      ) : null}
                      {commitOk ? (
                        <p className="form-banner form-banner-success" role="status">
                          {commitOk}
                        </p>
                      ) : null}
                      <p className="field-hint mission-github-hint">
                        Stages all changes (<code className="mission-edit-code">git add -A</code>) then commits. Push
                        uses the publish step above when no <code className="mission-edit-code">origin</code> exists yet.
                      </p>
                    </div>
                  </section>
                </div>
              ) : null}
            </>
          )}
        </div>

        <footer className="mission-edit-footer">
          <div className="mission-edit-footer-actions">
            {hasMissionRepo ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !commitMsg.trim() || statusLoading}
                onClick={() => void doCommit()}
              >
                {busy ? 'Working…' : 'Commit all'}
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy || statusLoading}
              onClick={() => void refresh()}
            >
              Refresh
            </button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => onClose()}>
              Close
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
