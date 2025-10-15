import { useState } from 'react'
import styles from './JoinRoom.module.css'
import { useRooms } from '@/hooks/useRooms'

interface JoinRoomProps {
  onJoin: (roomName: string) => Promise<void>
  disabled?: boolean
}

export default function JoinRoom({ onJoin, disabled = false }: JoinRoomProps) {
  const { enabledRooms, loading, error } = useRooms()
  const [selectedRoomId, setSelectedRoomId] = useState('')
  const [isJoining, setIsJoining] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRoomId || isJoining || disabled) return

    setIsJoining(true)
    try {
      await onJoin(selectedRoomId)
    } finally {
      setIsJoining(false)
    }
  }

  // Find the selected room details
  const selectedRoom = enabledRooms.find((room) => room.id === selectedRoomId)

  return (
    <div className={styles.section}>
      <div className={styles.card}>
        <h2>Join a Room</h2>

        {loading ? (
          <p className={styles.helpText}>Loading available rooms...</p>
        ) : error ? (
          <div className={styles.error}>
            <p>Error loading rooms: {error}</p>
            <p className={styles.helpText}>
              Please check that the server is running and try again.
            </p>
          </div>
        ) : enabledRooms.length === 0 ? (
          <p className={styles.helpText}>
            No rooms are currently available. Please check back later.
          </p>
        ) : (
          <>
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.selectWrapper}>
                <select
                  value={selectedRoomId}
                  onChange={(e) => setSelectedRoomId(e.target.value)}
                  disabled={isJoining || disabled}
                  className={styles.select}
                >
                  <option value="">Select a room...</option>
                  {enabledRooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.display_name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedRoom && (
                <div className={styles.roomPreview}>
                  <img
                    src={selectedRoom.image_url}
                    alt={selectedRoom.display_name}
                    className={styles.roomImage}
                  />
                  <div className={styles.roomInfo}>
                    <h3>{selectedRoom.display_name}</h3>
                    <p>{selectedRoom.description}</p>
                    <p className={styles.participantInfo}>
                      Max participants: {selectedRoom.max_participants}
                    </p>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isJoining || disabled || !selectedRoomId}
                className={`${styles.btn} ${styles.btnPrimary}`}
              >
                {isJoining ? 'Joining...' : 'Join Room'}
              </button>
            </form>

            <p className={styles.helpText}>
              Select a room from the dropdown to connect. Share the room name
              with your peer to join together.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
