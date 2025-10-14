/**
 * Portalbot VideoChat App
 * Main component for WebRTC video chat application
 */

import { useWebRTC } from '@/hooks/useWebRTC'
import StatusBar from '@/components/StatusBar'
import JoinRoom from '@/components/JoinRoom'
import VideoSection from '@/components/VideoSection'
import DebugInfo from '@/components/DebugInfo'
import styles from './App.module.css'

function App() {
  const webrtc = useWebRTC()

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Portalbot</h1>
        <p className={styles.subtitle}>
          Secure Video Chat with TURN Server Support
        </p>
      </header>

      <StatusBar
        status={webrtc.connectionStatus}
        statusText={webrtc.statusText}
        roomName={webrtc.currentRoom}
      />

      {!webrtc.currentRoom ? (
        <JoinRoom onJoin={webrtc.joinRoom} />
      ) : (
        <>
          <VideoSection
            localStream={webrtc.localStream}
            remoteStream={webrtc.remoteStream}
            onToggleAudio={webrtc.toggleAudio}
            onToggleVideo={webrtc.toggleVideo}
            onLeave={webrtc.leaveRoom}
            isAudioEnabled={webrtc.isAudioEnabled}
            isVideoEnabled={webrtc.isVideoEnabled}
            connectionState={webrtc.connectionState}
          />

          <DebugInfo
            connectionState={webrtc.connectionState}
            iceState={webrtc.iceState}
            signalingState={webrtc.signalingState}
          />
        </>
      )}

      {webrtc.error && (
        <div className={styles.errorMessage}>{webrtc.error}</div>
      )}
    </div>
  )
}

export default App
