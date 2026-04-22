import { useCallback, useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTimes } from '@fortawesome/free-solid-svg-icons'

export type OpenFileTab = {
  rel: string
  dirty: boolean
}

export type ScriptEditorTabsProps = {
  tabs: OpenFileTab[]
  activeRel: string | null
  onSelectTab: (rel: string) => void
  onCloseTab: (rel: string) => void
  disabled?: boolean
}

function fileBasename(relPosix: string): string {
  const parts = relPosix.split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1]! : relPosix
}

export function ScriptEditorTabs({
  tabs,
  activeRel,
  onSelectTab,
  onCloseTab,
  disabled,
}: ScriptEditorTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [showScrollHint, setShowScrollHint] = useState<'left' | 'right' | 'both' | null>(null)

  const updateScrollHints = useCallback(() => {
    const el = containerRef.current
    if (!el) {
      setShowScrollHint(null)
      return
    }
    const canScrollLeft = el.scrollLeft > 2
    const canScrollRight = el.scrollLeft < el.scrollWidth - el.clientWidth - 2
    if (canScrollLeft && canScrollRight) setShowScrollHint('both')
    else if (canScrollLeft) setShowScrollHint('left')
    else if (canScrollRight) setShowScrollHint('right')
    else setShowScrollHint(null)
  }, [])

  useEffect(() => {
    updateScrollHints()
    const el = containerRef.current
    if (!el) return
    el.addEventListener('scroll', updateScrollHints, { passive: true })
    window.addEventListener('resize', updateScrollHints)
    return () => {
      el.removeEventListener('scroll', updateScrollHints)
      window.removeEventListener('resize', updateScrollHints)
    }
  }, [updateScrollHints, tabs])

  useEffect(() => {
    const el = containerRef.current
    if (!el || !activeRel) return
    const active = el.querySelector(`[data-rel="${CSS.escape(activeRel)}"]`) as HTMLElement | null
    if (active) {
      active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    }
  }, [activeRel])

  if (tabs.length === 0) return null

  return (
    <div
      className={`script-editor-tabs${showScrollHint === 'left' || showScrollHint === 'both' ? ' scroll-hint-left' : ''}${showScrollHint === 'right' || showScrollHint === 'both' ? ' scroll-hint-right' : ''}`}
    >
      <div className="script-editor-tabs-inner" ref={containerRef}>
        {tabs.map((tab) => (
          <div
            key={tab.rel}
            data-rel={tab.rel}
            className={`script-editor-tab${activeRel === tab.rel ? ' is-active' : ''}${tab.dirty ? ' is-dirty' : ''}`}
          >
            <button
              type="button"
              className="script-editor-tab-btn"
              disabled={disabled}
              onClick={() => onSelectTab(tab.rel)}
              title={tab.rel}
            >
              <span className="script-editor-tab-name">{fileBasename(tab.rel)}</span>
              {tab.dirty && <span className="script-editor-tab-dirty" aria-label="Unsaved changes" />}
            </button>
            <button
              type="button"
              className="script-editor-tab-close"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation()
                onCloseTab(tab.rel)
              }}
              aria-label={`Close ${fileBasename(tab.rel)}`}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
