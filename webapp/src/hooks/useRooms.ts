/**
 * Custom hook for fetching available rooms from the server
 */

import { useEffect, useState } from 'react'
import type { Room, RoomsResponse } from '@/types/room'

interface UseRoomsReturn {
  rooms: Array<Room>
  enabledRooms: Array<Room>
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * Fetches the list of available rooms from the backend
 */
export function useRooms(): UseRoomsReturn {
  const [rooms, setRooms] = useState<Array<Room>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRooms = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/rooms')

      if (!response.ok) {
        throw new Error(`Failed to fetch rooms: ${response.statusText}`)
      }

      const data: RoomsResponse = await response.json()
      setRooms(data.rooms)
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('Error fetching rooms:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRooms()
  }, [])

  // Filter to only enabled rooms
  const enabledRooms = rooms.filter((room) => room.enabled)

  return {
    rooms,
    enabledRooms,
    loading,
    error,
    refetch: fetchRooms,
  }
}
