import { useRef, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSearch, faTimes } from '@fortawesome/free-solid-svg-icons'

type MissionSearchBarProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

export function MissionSearchBar({ value, onChange, placeholder = 'Search missions...', disabled }: MissionSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        onChange('')
        inputRef.current?.blur()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onChange])

  return (
    <div className="mission-search">
      <FontAwesomeIcon icon={faSearch} className="mission-search-icon" />
      <input
        ref={inputRef}
        type="text"
        className="mission-search-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
      {value && (
        <button
          type="button"
          className="mission-search-clear"
          onClick={() => {
            onChange('')
            inputRef.current?.focus()
          }}
          aria-label="Clear search"
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>
      )}
    </div>
  )
}
