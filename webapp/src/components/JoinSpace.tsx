import { useState } from 'react'
import styles from './JoinSpace.module.css'
import { useSpaces } from '@/hooks/useSpaces'

interface JoinSpaceProps {
  onJoin: (spaceName: string) => Promise<void>
  disabled?: boolean
}

export default function JoinSpace({ onJoin, disabled = false }: JoinSpaceProps) {
  const { enabledSpaces, loading, error } = useSpaces()
  const [joiningSpaceId, setJoiningSpaceId] = useState<string | null>(null)

  const handleSpaceClick = async (spaceId: string) => {
    if (joiningSpaceId || disabled) return

    setJoiningSpaceId(spaceId)
    try {
      await onJoin(spaceId)
    } finally {
      setJoiningSpaceId(null)
    }
  }

  return (
    <div className={styles.section}>
      <div className={styles.card}>
        <h2>Join a Space</h2>

        {loading ? (
          <p className={styles.helpText}>Loading available spaces...</p>
        ) : error ? (
          <div className={styles.error}>
            <p>Error loading spaces: {error}</p>
            <p className={styles.helpText}>
              Please check that the server is running and try again.
            </p>
          </div>
        ) : enabledSpaces.length === 0 ? (
          <p className={styles.helpText}>
            No spaces are currently available. Please check back later.
          </p>
        ) : (
          <>
            <ul className={styles.spaceList}>
              {enabledSpaces.map((space) => (
                <li key={space.id} className={styles.spaceListItem}>
                  <button
                    onClick={() => handleSpaceClick(space.id)}
                    disabled={joiningSpaceId !== null || disabled}
                    className={`${styles.spaceCard} ${
                      joiningSpaceId === space.id ? styles.spaceCardJoining : ''
                    }`}
                  >
                    <img
                      src={space.image_url}
                      alt={space.display_name}
                      className={styles.spaceCardImage}
                    />
                    <div className={styles.spaceCardContent}>
                      <h3 className={styles.spaceCardTitle}>
                        {space.display_name}
                      </h3>
                      <p className={styles.spaceCardDescription}>
                        {space.description}
                      </p>
                      <p className={styles.spaceCardParticipants}>
                        Max {space.max_participants} participants
                      </p>
                    </div>
                    {joiningSpaceId === space.id && (
                      <div className={styles.spaceCardSpinner}>Joining...</div>
                    )}
                  </button>
                </li>
              ))}
            </ul>

            <p className={styles.helpText}>
              Click on a space to join. Share the space name with your peer to
              connect together.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
