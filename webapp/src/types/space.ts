/**
 * Space configuration types matching the backend schema
 */

export interface Space {
  id: string
  display_name: string
  description: string
  image_url: string
  max_participants: number
  enabled: boolean
}

export interface SpacesResponse {
  version: string
  spaces: Array<Space>
}
