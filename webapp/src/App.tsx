/**
 * Portalbot VideoChat App
 * Main component for WebRTC video chat application
 */

import { useCallback, useEffect, useRef } from "react";
import styles from "./App.module.css";
import JoinSpace from "@/components/JoinSpace";
import VideoSection from "@/components/VideoSection";
import { useWebRTC } from "@/hooks/useWebRTC";
import ConnectionTag from "@/components/ConnectionTag";

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
        if (webrtc.ws === null) {
            return;
        }

        pendingJoinRef.current = routeSpaceId;
        webrtc.joinSpace(routeSpaceId);
    }, [
        isRouteControlled,
        routeSpaceId,
        webrtc.currentSpace,
        webrtc.joinSpace,
        webrtc.leaveSpace,
        webrtc.ws,
    ]);

    const isInSpace = isRouteControlled
        ? Boolean(routeSpaceId)
        : Boolean(webrtc.currentSpace);
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
                <img
                    className={styles.logo}
                    alt="Portalbot Logo"
                    src="/images/portal1_color_logo.png"
                />
                <div className={styles.titles}>
                    <h1 className={styles.title}>Portalbot</h1>
                    <p className={styles.subtitle}>
                        Telepresence powered by WebRTC. Join a space to get
                        started!
                    </p>
                </div>
                <ConnectionTag
                    status={webrtc.connectionStatus}
                    statusText={webrtc.statusText}
                />
            </header>

            {!isInSpace ? (
                <JoinSpace onJoin={handleJoin} />
            ) : (
                <VideoSection
                    localStream={webrtc.localStream}
                    remoteStream={webrtc.remoteStream}
                    hasControl={webrtc.hasControl}
                    isControlRequestPending={webrtc.isControlRequestPending}
                    onRequestControl={webrtc.requestControl}
                    onToggleAudio={webrtc.toggleAudio}
                    onToggleVideo={webrtc.toggleVideo}
                    onLeave={handleLeave}
                    isAudioEnabled={webrtc.isAudioEnabled}
                    isVideoEnabled={webrtc.isVideoEnabled}
                    connectionStatus={webrtc.connectionStatus}
                />
            )}

            {webrtc.error && (
                <div className={styles.errorMessage}>{webrtc.error}</div>
            )}
        </div>
    );
}

export default App;
