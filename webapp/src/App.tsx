/**
 * Portalbot VideoChat App
 * Main component for WebRTC video chat application
 */

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./App.module.css";

import type { Space } from "./types/space";

import { JoinSpace } from "@/components/JoinSpace";
import { VideoSection } from "@/components/VideoSection";
import { useWebRTC } from "@/hooks/useWebRTC";
import { RootHeader } from "@/components/RootHeader";
import { SpaceHeader } from "@/components/SpaceHeader";

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

    const handleJoin = useCallback(
        (space: Space) => {
            console.log("Joining space:", space);
            if (onSelectSpace) {
                onSelectSpace(space.id);
            } else {
                webrtc.joinSpace(space.id);
            }
        },
        [onSelectSpace, webrtc.joinSpace],
    );

    const isInSpace = isRouteControlled
        ? Boolean(routeSpaceId)
        : Boolean(webrtc.currentSpace);

    const handleLeave = useCallback(() => {
        suppressAutoJoinRef.current = true;
        pendingJoinRef.current = routeSpaceId ?? null;
        webrtc.leaveSpace();
        onExitSpace?.();
    }, [onExitSpace, routeSpaceId, webrtc.leaveSpace]);

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                {isInSpace ? (
                    <SpaceHeader space={}} onLeave={handleLeave} />
                ) : (
                    <RootHeader />
                )}
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
