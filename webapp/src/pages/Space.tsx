import { useCallback, useEffect, useRef } from "react";

import styles from "@/App.module.css";
import { SpaceHeader } from "@/components/SpaceHeader";
import { VideoSection } from "@/components/VideoSection";
import { useSpace } from "@/hooks/useSpace";
import { useWebRTC } from "@/hooks/useWebRTC";

export interface SpaceProps {
    spaceId: string;
    onExitSpace?: () => void;
}

export function Space({ spaceId, onExitSpace }: SpaceProps) {
    const webrtc = useWebRTC();
    const { space } = useSpace(spaceId);
    const pendingJoinRef = useRef<string | null>(null);
    const suppressAutoJoinRef = useRef(false);

    useEffect(() => {
        if (!spaceId) {
            return;
        }

        if (webrtc.currentSpace && webrtc.currentSpace !== spaceId) {
            pendingJoinRef.current = spaceId;
            webrtc.leaveSpace();
            return;
        }

        if (webrtc.currentSpace === spaceId) {
            pendingJoinRef.current = null;
            return;
        }

        if (pendingJoinRef.current === spaceId) {
            return;
        }

        if (suppressAutoJoinRef.current) {
            return;
        }

        if (webrtc.connectionStatus !== "connected") {
            return;
        }

        pendingJoinRef.current = spaceId;
        webrtc.joinSpace(spaceId);
    }, [
        spaceId,
        webrtc.currentSpace,
        webrtc.joinSpace,
        webrtc.leaveSpace,
        webrtc.connectionStatus,
    ]);

    const handleLeave = useCallback(() => {
        suppressAutoJoinRef.current = true;
        pendingJoinRef.current = spaceId;
        webrtc.leaveSpace();
        onExitSpace?.();
    }, [onExitSpace, spaceId, webrtc.leaveSpace]);

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <SpaceHeader space={space ?? undefined} onLeave={handleLeave} />
            </header>

            <VideoSection
                localStream={webrtc.localStream}
                remoteStream={webrtc.remoteStream}
                hasControl={webrtc.hasControl}
                onToggleAudio={webrtc.toggleAudio}
                onToggleVideo={webrtc.toggleVideo}
                isAudioEnabled={webrtc.isAudioEnabled}
                isVideoEnabled={webrtc.isVideoEnabled}
            />

            {webrtc.error && (
                <div className={styles.errorMessage}>{webrtc.error}</div>
            )}
        </div>
    );
}

export default Space;
