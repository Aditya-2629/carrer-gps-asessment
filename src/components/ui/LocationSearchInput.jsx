import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MagnifyingGlass,
  MapPin,
  X,
  Check,
  Globe,
  Buildings,
  NavigationArrow,
  Sparkle,
  Plus,
  Compass,
} from '@phosphor-icons/react'
import { searchLocations, POPULAR_HUBS, ALL_LOCATIONS } from '../../lib/usLocations'

// Helper to parse comma-separated or array location values into clean string items
function parseInitialLocations(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter(Boolean)
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  }
  return []
}

export default function LocationSearchInput({
  value = '',
  onChange,
  error,
  step,
  onNext,
}) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)

  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  // Normalize current selected locations into a clean array of strings
  const selectedLocations = useMemo(() => parseInitialLocations(value), [value])

  // Get search results
  const searchResults = useMemo(() => {
    return searchLocations(query, 12)
  }, [query])

  // Check if current query is already in results or selected
  const hasExactMatchInResults = useMemo(() => {
    if (!query.trim()) return true
    const qLower = query.trim().toLowerCase()
    return searchResults.some(
      (r) => r.label.toLowerCase() === qLower || r.value.toLowerCase() === qLower
    )
  }, [query, searchResults])

  // Click outside listener
  useEffect(() => {
    const handlePointerDownOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDownOutside)
    document.addEventListener('touchstart', handlePointerDownOutside)
    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside)
      document.removeEventListener('touchstart', handlePointerDownOutside)
    }
  }, [])

  // Auto-scroll highlighted option into view
  useEffect(() => {
    if (!isOpen || !listRef.current) return
    const activeItem = listRef.current.children[highlightIndex]
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [highlightIndex, isOpen])

  // Toggle or add location
  const toggleLocation = useCallback(
    (locValue) => {
      if (!locValue) return
      const cleanVal = locValue.trim()
      let updated
      if (selectedLocations.includes(cleanVal)) {
        updated = selectedLocations.filter((item) => item !== cleanVal)
      } else {
        updated = [...selectedLocations, cleanVal]
      }
      onChange(updated.join(', '))
      setQuery('')
      setHighlightIndex(0)
      inputRef.current?.focus()
    },
    [selectedLocations, onChange]
  )

  const removeLocation = useCallback(
    (locValue, e) => {
      e?.stopPropagation()
      const updated = selectedLocations.filter((item) => item !== locValue)
      onChange(updated.join(', '))
      inputRef.current?.focus()
    },
    [selectedLocations, onChange]
  )

  const clearAll = useCallback(
    (e) => {
      e?.stopPropagation()
      onChange('')
      setQuery('')
      inputRef.current?.focus()
    },
    [onChange]
  )

  // Keyboard navigation inside command palette
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
        return
      }
      const maxIndex = searchResults.length + (!hasExactMatchInResults && query.trim() ? 0 : -1)
      setHighlightIndex((prev) => (prev < maxIndex ? prev + 1 : 0))
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
        return
      }
      const maxIndex = searchResults.length + (!hasExactMatchInResults && query.trim() ? 0 : -1)
      setHighlightIndex((prev) => (prev > 0 ? prev - 1 : maxIndex))
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      if (isOpen) {
        if (!hasExactMatchInResults && query.trim() && highlightIndex === searchResults.length) {
          // Add custom location
          toggleLocation(query.trim())
          return
        }
        if (searchResults[highlightIndex]) {
          toggleLocation(searchResults[highlightIndex].value)
          return
        }
      }

      // If dropdown is closed and user has at least one selection, allow Enter to submit step
      if (!isOpen && selectedLocations.length > 0) {
        onNext?.()
      }
      return
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
      return
    }

    if (e.key === 'Backspace' && !query && selectedLocations.length > 0) {
      // Remove last tag
      const last = selectedLocations[selectedLocations.length - 1]
      removeLocation(last)
    }
  }

  // Find icon or emoji for a location string
  const getIconForSelected = (locStr) => {
    if (locStr.toLowerCase().includes('remote')) return '🌐'
    const found = ALL_LOCATIONS.find(
      (l) => l.value.toLowerCase() === locStr.toLowerCase() || l.label.toLowerCase() === locStr.toLowerCase()
    )
    return found?.icon || '📍'
  }

  const hasRemote = selectedLocations.some((l) => l.toLowerCase().includes('remote'))
  const isMulti = selectedLocations.length >= 2

  return (
    <div className="flex flex-col gap-3 w-full" ref={containerRef}>
      {/* Selected Location Chips */}
      <AnimatePresence>
        {selectedLocations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex flex-wrap items-center gap-2 p-2 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)]"
          >
            <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] px-2 py-0.5">
              <Compass size={13} weight="bold" className="text-[var(--primary)]" />
              <span>Target Coordinates ({selectedLocations.length}):</span>
            </div>

            {selectedLocations.map((loc) => (
              <motion.span
                key={loc}
                layout
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface-card)] text-xs font-semibold text-[var(--text-primary)] border border-[var(--border-default)] shadow-xs hover:border-[var(--primary)] transition-all group"
              >
                <span className="select-none text-sm">{getIconForSelected(loc)}</span>
                <span>{loc}</span>
                <button
                  type="button"
                  onClick={(e) => removeLocation(loc, e)}
                  aria-label={`Remove ${loc}`}
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error-bg)] transition-colors cursor-pointer ml-0.5"
                >
                  <X size={11} weight="bold" />
                </button>
              </motion.span>
            ))}

            {selectedLocations.length > 1 && (
              <button
                type="button"
                onClick={clearAll}
                className="text-[11px] text-[var(--text-muted)] hover:text-[var(--error)] px-2 py-1 underline cursor-pointer ml-auto transition-colors"
              >
                Clear all
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Search Bar — Google Maps / Command Palette Aesthetic */}
      <div className="relative">
        <div
          className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all duration-200 bg-[var(--surface-card)] shadow-xs ${
            isOpen
              ? 'border-[var(--primary)] ring-3 ring-[var(--primary-ring)]'
              : error
              ? 'border-[var(--error)] ring-2 ring-[var(--error-bg)]'
              : 'border-[var(--border-default)] hover:border-[var(--border-hover)]'
          }`}
          onClick={() => {
            inputRef.current?.focus()
            setIsOpen(true)
          }}
        >
          <div className="text-[var(--primary)] shrink-0 flex items-center justify-center">
            <MagnifyingGlass size={20} weight="bold" />
          </div>

          <input
            ref={inputRef}
            id={`location-search-input-${step.id}`}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setIsOpen(true)
              setHighlightIndex(0)
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedLocations.length === 0
                ? 'Search for a state, city, metro, or choose Remote...'
                : 'Add another city, state, metro, or Remote...'
            }
            className="w-full bg-transparent border-0 outline-hidden text-base text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            autoComplete="off"
            spellCheck="false"
            aria-label="Search locations"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
          />

          {query && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setQuery('')
                inputRef.current?.focus()
              }}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-md transition-colors cursor-pointer"
              title="Clear search text"
            >
              <X size={16} weight="bold" />
            </button>
          )}

          <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono text-[var(--text-muted)] bg-[var(--surface-sunken)] px-2 py-0.5 rounded border border-[var(--border-default)] shrink-0 select-none">
            <span>U.S. Search</span>
          </div>
        </div>

        {/* Dropdown Command Palette */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.99 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="absolute z-50 left-0 right-0 top-full mt-2 rounded-xl bg-[var(--surface-card)] border border-[var(--border-default)] shadow-xl overflow-hidden backdrop-blur-md"
              style={{ maxHeight: '340px' }}
            >
              {/* Header inside command palette */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-default)] bg-[var(--surface-sunken)]/60 text-xs text-[var(--text-muted)] font-medium">
                <span className="flex items-center gap-1.5">
                  <NavigationArrow size={12} weight="fill" className="text-[var(--primary)]" />
                  {query.trim()
                    ? `Matching locations (${searchResults.length})`
                    : 'Popular U.S. Career Epicenters & Tech Metros'}
                </span>
                <span className="text-[10px] hidden sm:inline">Use ↑ ↓ arrows & Enter</span>
              </div>

              {/* List */}
              <div
                ref={listRef}
                role="listbox"
                className="overflow-y-auto p-1.5 max-h-[280px] divide-y divide-[var(--border-muted)]"
              >
                {searchResults.map((item, idx) => {
                  const isSelected = selectedLocations.includes(item.value)
                  const isHighlighted = highlightIndex === idx

                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => toggleLocation(item.value)}
                      onMouseEnter={() => setHighlightIndex(idx)}
                      className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg text-left transition-all cursor-pointer ${
                        isHighlighted
                          ? 'bg-[var(--surface-strong)] text-[var(--text-primary)]'
                          : isSelected
                          ? 'bg-[var(--primary-light)]/40 text-[var(--text-primary)]'
                          : 'hover:bg-[var(--surface-sunken)] text-[var(--text-primary)]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Icon */}
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 border ${
                            isSelected
                              ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                              : 'bg-[var(--surface-card)] border-[var(--border-default)] text-[var(--text-primary)]'
                          }`}
                        >
                          {isSelected ? <Check size={16} weight="bold" /> : item.icon}
                        </div>

                        {/* Title & Metadata */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm leading-tight text-[var(--text-primary)] truncate">
                              {item.label}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                                item.category === 'remote'
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                  : item.category === 'metro'
                                  ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30'
                                  : item.category === 'city'
                                  ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30'
                                  : 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/30'
                              }`}
                            >
                              {item.categoryLabel}
                            </span>
                          </div>

                          {item.meta && (
                            <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                              {item.meta}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Action status */}
                      <div className="shrink-0 text-right">
                        {isSelected ? (
                          <span className="text-xs font-semibold text-[var(--primary)] flex items-center gap-1">
                            Selected
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity">
                            Add +
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}

                {/* Custom location fallback if user typed something not in dataset */}
                {!hasExactMatchInResults && query.trim() && (
                  <button
                    type="button"
                    role="option"
                    onClick={() => toggleLocation(query.trim())}
                    onMouseEnter={() => setHighlightIndex(searchResults.length)}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-lg text-left transition-all cursor-pointer border-t border-[var(--border-default)] ${
                      highlightIndex === searchResults.length
                        ? 'bg-[var(--surface-strong)] text-[var(--primary)]'
                        : 'hover:bg-[var(--surface-sunken)]'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center shrink-0 border border-[var(--primary)]/20">
                      <Plus size={16} weight="bold" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        Add &ldquo;<span className="text-[var(--primary)]">{query.trim()}</span>&rdquo; as target location
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        Custom U.S. city, territory, or specialized job perimeter
                      </p>
                    </div>
                  </button>
                )}
              </div>

              {/* Dropdown footer info */}
              <div className="px-4 py-2 bg-[var(--surface-sunken)]/80 border-t border-[var(--border-default)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                <span>Select one or more target regions</span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="font-medium hover:text-[var(--primary)] cursor-pointer"
                >
                  Done Selecting
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Quick Click Suggestions Bar */}
      <div className="flex flex-wrap items-center gap-1.5 mt-1">
        <span className="text-xs font-semibold text-[var(--text-muted)] mr-1 flex items-center gap-1">
          <Sparkle size={12} weight="fill" className="text-[var(--primary)]" />
          <span>Quick Hubs:</span>
        </span>
        {POPULAR_HUBS.map((hub) => {
          const isSelected = selectedLocations.includes(hub.value)
          return (
            <button
              key={hub.id}
              type="button"
              onClick={() => toggleLocation(hub.value)}
              className={`text-xs px-2.5 py-1 rounded-md font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-xs'
                  : 'bg-[var(--surface-sunken)] border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]'
              }`}
            >
              <span>{hub.icon}</span>
              <span>{hub.value}</span>
              {isSelected && <Check size={12} weight="bold" />}
            </button>
          )
        })}
      </div>

      {/* Career GPS Intelligence Signal based on selection */}
      <div className="mt-1">
        {hasRemote ? (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300">
            <Globe size={15} weight="fill" className="shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>
              <strong>Remote Mobility Active:</strong> Unlocks nationwide hiring pipelines (+140% more candidate callbacks across U.S. companies).
            </span>
          </div>
        ) : isMulti ? (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[var(--primary-light)] border border-[var(--primary)]/20 text-xs text-[var(--primary)]">
            <Buildings size={15} weight="fill" className="shrink-0 text-[var(--primary)]" />
            <span>
              <strong>Multi-Hub Strategy Active:</strong> Targeting {selectedLocations.length} metropolitan regions expands recruiter outreach breadth.
            </span>
          </div>
        ) : selectedLocations.length === 1 ? (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border-default)] text-xs text-[var(--text-muted)]">
            <MapPin size={15} weight="bold" className="shrink-0 text-[var(--primary)]" />
            <span>
              <strong>Primary Hub Locked:</strong> You can add more cities, states, or Remote anytime to broaden your radius.
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
