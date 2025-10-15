import type { ConnectionStatus } from '@/types/webrtc'
import styles from './StatusBar.module.css'

interface StatusBarProps {
  status: ConnectionStatus
  statusText: string
  roomName?: string | null
}

export default function StatusBar({
  status,
  statusText,
  roomName,
}: StatusBarProps) {
  return (
    <div className={styles.statusBar}>
      <span className={`${styles.statusIndicator} ${styles[status]}`}>
        {statusText}
      </span>
      {roomName && (
        <span className={styles.roomInfo}>Room: {roomName}</span>
      )}
    </div>
  )
}
