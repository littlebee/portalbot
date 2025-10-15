import { useState } from 'react'
import styles from './JoinRoom.module.css'

interface JoinRoomProps {
  onJoin: (roomName: string) => Promise<void>
  disabled?: boolean
}

export default function JoinRoom({ onJoin, disabled = false }: JoinRoomProps) {
  const [roomName, setRoomName] = useState('')
  const [isJoining, setIsJoining] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!roomName.trim() || isJoining || disabled) return

    setIsJoining(true)
    try {
      await onJoin(roomName.trim())
    } finally {
      setIsJoining(false)
    }
  }

  return (
    <div className={styles.section}>
      <div className={styles.card}>
        <h2>Join a Room</h2>
        <form onSubmit={handleSubmit} className={styles.inputGroup}>
          <input
            type="text"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="Enter room name"
            autoComplete="off"
            disabled={isJoining || disabled}
            className={styles.input}
          />
          <button
            type="submit"
            disabled={isJoining || disabled || !roomName.trim()}
            className={`${styles.btn} ${styles.btnPrimary}`}
          >
            {isJoining ? 'Joining...' : 'Join Room'}
          </button>
        </form>
        <p className={styles.helpText}>
          Share the room name with your peer to connect. Maximum 2 participants
          per room.
        </p>
      </div>
    </div>
  )
}
