/**
 * Room configuration types matching the backend schema
 */

export interface Room {
  id: string
  display_name: string
  description: string
  image_url: string
  max_participants: number
  enabled: boolean
}

export interface RoomsResponse {
  version: string
  rooms: Array<Room>
}
