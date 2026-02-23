/**
 * Portalbot VideoChat App
 * Main component for WebRTC video chat application
 */

import { useCallback, useEffect, useRef } from "react";
import styles from "./App.module.css";
import DebugInfo from "@/components/DebugInfo";
import JoinSpace from "@/components/JoinSpace";
import StatusBar from "@/components/StatusBar";
import VideoSection from "@/components/VideoSection";
import { useWebRTC } from "@/hooks/useWebRTC";

interface AppProps {
    routeSpaceId?: string | null;
    onSelectSpace?: (spaceId: string) => Promise<void>;
    onExitSpace?: () => void;
}

function App({ routeSpaceId, onSelectSpace, onExitSpace }: AppProps) {
    const webrtc = useWebRTC();
    const pendingJoinRef = useRef<string | null>(null);
    const suppressAutoJoinRef = useRef(false);
    const isRouteControlled = routeSpaceId !== undefined;

    useEffect(() => {
        if (!isRouteControlled) {
            return;
        }

        if (!routeSpaceId) {
            pendingJoinRef.current = null;
            suppressAutoJoinRef.current = false;
            if (webrtc.currentSpace) {
                webrtc.leaveSpace();
            }
            return;
        }

        if (webrtc.currentSpace && webrtc.currentSpace !== routeSpaceId) {
            pendingJoinRef.current = routeSpaceId;
            webrtc.leaveSpace();
            return;
        }

        if (webrtc.currentSpace === routeSpaceId) {
            pendingJoinRef.current = null;
            return;
        }

        if (pendingJoinRef.current === routeSpaceId) {
            return;
        }
        if (suppressAutoJoinRef.current) {
            return;
        }

        pendingJoinRef.current = routeSpaceId;
        void webrtc.joinSpace(routeSpaceId);
    }, [
        isRouteControlled,
        routeSpaceId,
        webrtc.currentSpace,
        webrtc.joinSpace,
        webrtc.leaveSpace,
    ]);

    const isInSpace = isRouteControlled
        ? Boolean(routeSpaceId)
        : Boolean(webrtc.currentSpace);
    const selectedSpaceName = routeSpaceId ?? webrtc.currentSpace;
    const handleJoin = onSelectSpace ?? webrtc.joinSpace;
    const handleLeave = useCallback(() => {
        suppressAutoJoinRef.current = true;
        pendingJoinRef.current = routeSpaceId ?? null;
        webrtc.leaveSpace();
        onExitSpace?.();
    }, [onExitSpace, routeSpaceId, webrtc.leaveSpace]);

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
                spaceName={selectedSpaceName}
            />

            {!isInSpace ? (
                <JoinSpace onJoin={handleJoin} />
            ) : (
                <>
                    <VideoSection
                        localStream={webrtc.localStream}
                        remoteStream={webrtc.remoteStream}
                        onToggleAudio={webrtc.toggleAudio}
                        onToggleVideo={webrtc.toggleVideo}
                        onLeave={handleLeave}
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
