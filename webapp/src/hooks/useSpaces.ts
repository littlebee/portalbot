/**
 * Custom hook for fetching available spaces from the server
 */

import { useEffect, useState } from 'react'
import type { Space, SpacesResponse } from '@/types/space'

interface UseSpacesReturn {
  spaces: Array<Space>
  enabledSpaces: Array<Space>
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * Fetches the list of available spaces from the backend
 */
export function useSpaces(): UseSpacesReturn {
  const [spaces, setSpaces] = useState<Array<Space>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSpaces = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/spaces')

      if (!response.ok) {
        throw new Error(`Failed to fetch spaces: ${response.statusText}`)
      }

      const data: SpacesResponse = await response.json()
      setSpaces(data.spaces)
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('Error fetching spaces:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSpaces()
  }, [])

  // Filter to only enabled spaces
  const enabledSpaces = spaces.filter((space) => space.enabled)

  return {
    spaces,
    enabledSpaces,
    loading,
    error,
    refetch: fetchSpaces,
  }
}
