import { useEffect, useRef } from "react";

import styles from "./VideoSection.module.css";
import LocalVideo from "./LocalVideo";

interface VideoSectionProps {
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    hasControl: boolean;
    isControlRequestPending: boolean;
    onRequestControl: () => void;
    onToggleAudio: () => void;
    onToggleVideo: () => void;
    isAudioEnabled: boolean;
    isVideoEnabled: boolean;
    connectionStatus: string;
}

export function VideoSection({
    localStream,
    remoteStream,
    hasControl,
    isControlRequestPending,
    onRequestControl,
    onToggleAudio,
    onToggleVideo,
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
                    <LocalVideo
                        localStream={localStream}
                        onToggleAudio={onToggleAudio}
                        onToggleVideo={onToggleVideo}
                        isAudioEnabled={isAudioEnabled}
                        isVideoEnabled={isVideoEnabled}
                    />
                )}
            </div>
        </div>
    );
}

export default VideoSection;
