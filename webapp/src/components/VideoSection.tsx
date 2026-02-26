import { useEffect, useRef } from "react";
import cx from "classnames";

import styles from "./VideoSection.module.css";
import StreamingControls from "./StreamingControls";

interface VideoSectionProps {
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    hasControl: boolean;
    isControlRequestPending: boolean;
    onRequestControl: () => void;
    onToggleAudio: () => void;
    onToggleVideo: () => void;
    onLeave: () => void;
    isAudioEnabled: boolean;
    isVideoEnabled: boolean;
    connectionStatus: string;
}

export default function VideoSection({
    localStream,
    remoteStream,
    hasControl,
    isControlRequestPending,
    onRequestControl,
    onToggleAudio,
    onToggleVideo,
    onLeave,
    isAudioEnabled,
    isVideoEnabled,
    connectionStatus,
}: VideoSectionProps) {
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    // Attach local stream to video element
    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    // Attach remote stream to video element
    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream]);

    const statusText = remoteStream ? "" : "Waiting for peer...";

    return (
        <div className={styles.section}>
            <div className={styles.videoContainer}>
                <div className={styles.videoWrapper}>
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className={styles.video}
                    />
                    <div className={styles.videoLabel}>Remote Video</div>
                    {statusText && (
                        <div className={styles.connectionStatus}>
                            {statusText}
                        </div>
                    )}
                </div>

                {hasControl && (
                    <div className={cx(styles.videoWrapper, styles.local)}>
                        <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className={cx(styles.video, styles.localVideo)}
                        />
                    </div>
                )}
            </div>

            <StreamingControls
                hasControl={hasControl}
                isControlRequestPending={isControlRequestPending}
                onRequestControl={onRequestControl}
                onToggleAudio={onToggleAudio}
                onToggleVideo={onToggleVideo}
                onLeave={onLeave}
                isAudioEnabled={isAudioEnabled}
                isVideoEnabled={isVideoEnabled}
            />
        </div>
    );
}
