import { useCallback, useState } from 'react'
import type { AiFieldKey, AiFieldMap } from './types'

const EMPTY_FIELD = { pending: null, dirty: false }

const initialFields: AiFieldMap = {
  title: { ...EMPTY_FIELD },
  slug: { ...EMPTY_FIELD },
  description: { ...EMPTY_FIELD },
  keywords: { ...EMPTY_FIELD },
}

/**
 * Owns the per-field AI suggestion state so GlobalAiTrigger and SeoCard share
 * one source of truth. The committed form values still live in PostEditor;
 * this hook only tracks pending suggestions, dirty flags, and the transient
 * green flash set.
 *
 * Invariants:
 *  - AI never writes to the committed value directly — it only fills `pending`.
 *  - Manual edit clears pending and marks dirty (the user's intent wins).
 */
export function useAiSuggestions() {
  const [fields, setFields] = useState<AiFieldMap>(initialFields)
  const [flashing, setFlashing] = useState<Set<AiFieldKey>>(new Set())

  /** Seed pending suggestions after a global AI run. Dirty fields are not seeded. */
  const seedSuggestions = useCallback((next: Partial<Record<AiFieldKey, string>>) => {
    setFields((prev) => {
      const updated = { ...prev }
      for (const key of Object.keys(next) as AiFieldKey[]) {
        const value = next[key]
        if (value === undefined) continue
        // Only set pending for non-empty values; empty strings are treated as no suggestion.
        if (value === '') {
          updated[key] = {
            ...prev[key],
            pending: null,
          }
        } else {
          // Skip seeding dirty fields (user's manual edit wins)
          if (prev[key].dirty) continue
          updated[key] = {
            ...prev[key],
            pending: value,
          }
        }
      }
      return updated
    })
  }, [])

  /** Called by each input's onChange — marks the committed value as user-authored. */
  const markDirty = useCallback((key: AiFieldKey) => {
    setFields((prev) => ({
      ...prev,
      [key]: { ...prev[key], dirty: true, pending: null },
    }))
  }, [])

  /** Clear a field back to clean after its pending value was applied. */
  const clearApplied = useCallback((keys: AiFieldKey[]) => {
    setFields((prev) => {
      const updated = { ...prev }
      for (const key of keys) {
        updated[key] = { ...EMPTY_FIELD }
      }
      return updated
    })
  }, [])

  /** Flash the given fields green for ~0.6s to signal they were just auto-filled. */
  const flash = useCallback((keys: AiFieldKey[]) => {
    if (keys.length === 0) return
    setFlashing(new Set(keys))
    setTimeout(() => setFlashing(new Set()), 600)
  }, [])

  return { fields, flashing, seedSuggestions, markDirty, clearApplied, flash }
}
