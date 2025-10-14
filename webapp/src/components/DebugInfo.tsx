import styles from './DebugInfo.module.css'

interface DebugInfoProps {
  connectionState: RTCPeerConnectionState
  iceState: RTCIceConnectionState
  signalingState: RTCSignalingState
  turnServer?: string
}

export default function DebugInfo({
  connectionState,
  iceState,
  signalingState,
  turnServer = 'turn:ec2-3-134-87-34.us-east-2.compute.amazonaws.com:3478',
}: DebugInfoProps) {
  return (
    <div className={styles.section}>
      <details className={styles.details}>
        <summary className={styles.summary}>Connection Info</summary>
        <div className={styles.debugInfo}>
          <div className={styles.debugRow}>
            <strong>Connection State:</strong>
            <span>{connectionState}</span>
          </div>
          <div className={styles.debugRow}>
            <strong>ICE State:</strong>
            <span>{iceState}</span>
          </div>
          <div className={styles.debugRow}>
            <strong>Signaling State:</strong>
            <span>{signalingState}</span>
          </div>
          <div className={styles.debugRow}>
            <strong>TURN Server:</strong>
            <span>{turnServer}</span>
          </div>
        </div>
      </details>
    </div>
  )
}
