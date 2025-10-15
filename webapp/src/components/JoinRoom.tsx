import { useState } from 'react'
import styles from './JoinRoom.module.css'
import { useRooms } from '@/hooks/useRooms'

interface JoinRoomProps {
  onJoin: (roomName: string) => Promise<void>
  disabled?: boolean
}

export default function JoinRoom({ onJoin, disabled = false }: JoinRoomProps) {
  const { enabledRooms, loading, error } = useRooms()
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null)

  const handleRoomClick = async (roomId: string) => {
    if (joiningRoomId || disabled) return

    setJoiningRoomId(roomId)
    try {
      await onJoin(roomId)
    } finally {
      setJoiningRoomId(null)
    }
  }

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
            <ul className={styles.roomList}>
              {enabledRooms.map((room) => (
                <li key={room.id} className={styles.roomListItem}>
                  <button
                    onClick={() => handleRoomClick(room.id)}
                    disabled={joiningRoomId !== null || disabled}
                    className={`${styles.roomCard} ${
                      joiningRoomId === room.id ? styles.roomCardJoining : ''
                    }`}
                  >
                    <img
                      src={room.image_url}
                      alt={room.display_name}
                      className={styles.roomCardImage}
                    />
                    <div className={styles.roomCardContent}>
                      <h3 className={styles.roomCardTitle}>
                        {room.display_name}
                      </h3>
                      <p className={styles.roomCardDescription}>
                        {room.description}
                      </p>
                      <p className={styles.roomCardParticipants}>
                        Max {room.max_participants} participants
                      </p>
                    </div>
                    {joiningRoomId === room.id && (
                      <div className={styles.roomCardSpinner}>Joining...</div>
                    )}
                  </button>
                </li>
              ))}
            </ul>

            <p className={styles.helpText}>
              Click on a room to join. Share the room name with your peer to
              connect together.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
