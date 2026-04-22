import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { OnMount } from '@monaco-editor/react'

export type EditorShell = {
  editor: Parameters<OnMount>[0]
  monaco: Parameters<OnMount>[1]
}

export type SymbolEntry = {
  name: string
  kind: 'function' | 'variable' | 'class'
  line: number
  column: number
}

export type ScriptEditorGoToProps = {
  open: boolean
  mode: 'line' | 'symbol'
  onOpenChange: (open: boolean) => void
  getShell: () => EditorShell | null
  documentText: string
  disabled?: boolean
}

function extractSymbols(text: string): SymbolEntry[] {
  const symbols: SymbolEntry[] = []
  const lines = text.split(/\r?\n/)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const fnMatch = /^\s*(\w+)\s*=\s*\{/.exec(line)
    if (fnMatch) {
      symbols.push({
        name: fnMatch[1],
        kind: 'function',
        line: i + 1,
        column: (line.indexOf(fnMatch[1]) || 0) + 1,
      })
    }

    const fnCallMatch = /^\s*(\w+)\s*=\s*compile\s/.exec(line)
    if (fnCallMatch) {
      symbols.push({
        name: fnCallMatch[1],
        kind: 'function',
        line: i + 1,
        column: (line.indexOf(fnCallMatch[1]) || 0) + 1,
      })
    }

    const privateMatch = /private\s*\[\s*"([^"]+)"/.exec(line)
    if (privateMatch) {
      symbols.push({
        name: privateMatch[1],
        kind: 'variable',
        line: i + 1,
        column: (line.indexOf(privateMatch[1]) || 0) + 1,
      })
    }

    const paramsMatch = /params\s*\[\s*(.+?)\s*\]/i.exec(line)
    if (paramsMatch) {
      const inner = paramsMatch[1]
      const varMatches = inner.matchAll(/"(_\w+)"/g)
      for (const m of varMatches) {
        symbols.push({
          name: m[1],
          kind: 'variable',
          line: i + 1,
          column: (line.indexOf(m[1]) || 0) + 1,
        })
      }
    }

    const classMatch = /^\s*class\s+(\w+)/i.exec(line)
    if (classMatch) {
      symbols.push({
        name: classMatch[1],
        kind: 'class',
        line: i + 1,
        column: (line.indexOf(classMatch[1]) || 0) + 1,
      })
    }
  }

  return symbols
}

export function ScriptEditorGoTo({
  open,
  mode,
  onOpenChange,
  getShell,
  documentText,
  disabled,
}: ScriptEditorGoToProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const labelId = useId()
  const inputId = useId()

  const symbols = useMemo(() => {
    if (mode !== 'symbol') return []
    return extractSymbols(documentText)
  }, [documentText, mode])

  const filteredSymbols = useMemo(() => {
    if (mode !== 'symbol') return []
    if (!query.trim()) return symbols
    const q = query.toLowerCase()
    return symbols.filter((s) => s.name.toLowerCase().includes(q))
  }, [symbols, query, mode])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setSelectedIndex(0)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
  }, [open, mode])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onOpenChange(false)
        getShell()?.editor.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, onOpenChange, getShell])

  const goToLine = useCallback(
    (lineNum: number) => {
      const shell = getShell()
      if (!shell) return
      const model = shell.editor.getModel()
      if (!model) return
      const maxLine = model.getLineCount()
      const line = Math.max(1, Math.min(lineNum, maxLine))
      shell.editor.setPosition({ lineNumber: line, column: 1 })
      shell.editor.revealLineInCenter(line)
      shell.editor.focus()
      onOpenChange(false)
    },
    [getShell, onOpenChange],
  )

  const goToSymbol = useCallback(
    (sym: SymbolEntry) => {
      const shell = getShell()
      if (!shell) return
      shell.editor.setPosition({ lineNumber: sym.line, column: sym.column })
      shell.editor.revealLineInCenter(sym.line)
      shell.editor.focus()
      onOpenChange(false)
    },
    [getShell, onOpenChange],
  )

  const handleSubmit = useCallback(() => {
    if (mode === 'line') {
      const num = parseInt(query, 10)
      if (Number.isFinite(num) && num > 0) {
        goToLine(num)
      }
    } else {
      const sym = filteredSymbols[selectedIndex]
      if (sym) {
        goToSymbol(sym)
      }
    }
  }, [mode, query, filteredSymbols, selectedIndex, goToLine, goToSymbol])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (mode === 'symbol') {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSelectedIndex((i) => Math.min(i + 1, filteredSymbols.length - 1))
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSelectedIndex((i) => Math.max(i - 1, 0))
        }
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSubmit()
      }
    },
    [mode, filteredSymbols.length, handleSubmit],
  )

  useEffect(() => {
    if (mode !== 'symbol' || !listRef.current) return
    const active = listRef.current.querySelector('.is-selected') as HTMLElement | null
    if (active) {
      active.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex, mode])

  if (!open) return null

  const shell = getShell()
  const lineCount = shell?.editor.getModel()?.getLineCount() ?? 0

  return (
    <div className="script-editor-goto">
      <div className="script-editor-goto-inner">
        <label id={labelId} className="script-editor-goto-label" htmlFor={inputId}>
          {mode === 'line' ? `Go to line (1-${lineCount})` : 'Go to symbol'}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type={mode === 'line' ? 'number' : 'text'}
          className="field-input script-editor-goto-input"
          value={query}
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck={false}
          placeholder={mode === 'line' ? 'Line number...' : 'Symbol name...'}
          min={mode === 'line' ? 1 : undefined}
          max={mode === 'line' ? lineCount : undefined}
        />
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={disabled || (mode === 'line' && !query.trim())}
          onClick={handleSubmit}
        >
          Go
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm script-editor-goto-close"
          onClick={() => {
            onOpenChange(false)
            getShell()?.editor.focus()
          }}
          aria-label="Close"
        >
          ×
        </button>
      </div>
      {mode === 'symbol' && filteredSymbols.length > 0 && (
        <ul className="script-editor-goto-list" ref={listRef}>
          {filteredSymbols.map((sym, i) => (
            <li key={`${sym.name}-${sym.line}`}>
              <button
                type="button"
                className={`script-editor-goto-item${i === selectedIndex ? ' is-selected' : ''}`}
                disabled={disabled}
                onClick={() => goToSymbol(sym)}
              >
                <span className={`script-editor-goto-kind script-editor-goto-kind-${sym.kind}`}>
                  {sym.kind === 'function' ? 'fn' : sym.kind === 'variable' ? 'var' : 'cls'}
                </span>
                <span className="script-editor-goto-name">{sym.name}</span>
                <span className="script-editor-goto-loc">:{sym.line}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {mode === 'symbol' && query.trim() && filteredSymbols.length === 0 && (
        <p className="script-editor-goto-empty">No symbols found</p>
      )}
    </div>
  )
}
