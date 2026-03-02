import { useCallback, useEffect, useRef, useState } from "react";

import styles from "@/App.module.css";
import { SpaceHeader } from "@/components/SpaceHeader";
import { VideoSection } from "@/components/VideoSection";
import { useSpace } from "@/hooks/useSpace";
import { useWebRTC } from "@/hooks/useWebRTC";
import { PanTilt } from "@/components/PanTilt";

export interface SpaceProps {
    spaceId: string;
    onExitSpace?: () => void;
}

export function Space({ spaceId, onExitSpace }: SpaceProps) {
    const webrtc = useWebRTC();
    const { space } = useSpace(spaceId);
    const pendingJoinRef = useRef<string | null>(null);
    const suppressAutoJoinRef = useRef(false);
    const [currentAngles, setCurrentAngles] = useState<{
        pan: number;
        tilt: number;
    } | null>(null);

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

    const handleServoAngleChange = useCallback(
        (panAngle: number, tiltAngle: number) => {
            const angles = { pan: panAngle, tilt: tiltAngle };
            setCurrentAngles(angles);
            webrtc.sendAngles(angles);
        },
        [webrtc],
    );

    const panServoConfig = webrtc.servoConfigByName?.["pan"];
    const tiltServoConfig = webrtc.servoConfigByName?.["tilt"];

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <SpaceHeader space={space ?? undefined} onLeave={handleLeave} />
            </header>

            <VideoSection
                localStream={webrtc.localStream}
                remoteStream={webrtc.remoteStream}
                hasControl={webrtc.hasControl}
                onRequestControl={webrtc.requestControl}
                isAudioEnabled={webrtc.isAudioEnabled}
                onToggleAudio={webrtc.toggleAudio}
                isVideoEnabled={webrtc.isVideoEnabled}
                onToggleVideo={webrtc.toggleVideo}
            />

            {webrtc.hasControl && panServoConfig && tiltServoConfig && (
                <PanTilt
                    panConfig={panServoConfig}
                    tiltConfig={tiltServoConfig}
                    panAngle={currentAngles?.pan ?? 90}
                    tiltAngle={currentAngles?.tilt ?? 90}
                    onAngleChange={handleServoAngleChange}
                />
            )}

            {webrtc.error && (
                <div className={styles.errorMessage}>{webrtc.error}</div>
            )}
        </div>
    );
}

export default Space;
