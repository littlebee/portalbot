/**
 * Portalbot VideoChat App
 * Main component for WebRTC video chat application
 */

import styles from "./App.module.css";
import DebugInfo from "@/components/DebugInfo";
import JoinSpace from "@/components/JoinSpace";
import StatusBar from "@/components/StatusBar";
import VideoSection from "@/components/VideoSection";
import { useWebRTC } from "@/hooks/useWebRTC";

function App() {
    const webrtc = useWebRTC();

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
                spaceName={webrtc.currentSpace}
            />

            {!webrtc.currentSpace ? (
                <JoinSpace onJoin={webrtc.joinSpace} />
            ) : (
                <>
                    <VideoSection
                        localStream={webrtc.localStream}
                        remoteStream={webrtc.remoteStream}
                        onToggleAudio={webrtc.toggleAudio}
                        onToggleVideo={webrtc.toggleVideo}
                        onLeave={webrtc.leaveSpace}
                        isAudioEnabled={webrtc.isAudioEnabled}
                        isVideoEnabled={webrtc.isVideoEnabled}
                        connectionStatus={webrtc.connectionStatus}
                    />

                    <DebugInfo connectionStatus={webrtc.connectionStatus} />
                </>
            )}

            {webrtc.error && (
                <div className={styles.errorMessage}>{webrtc.error}</div>
            )}
        </div>
    );
}

export default App;
