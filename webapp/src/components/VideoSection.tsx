import { useCallback, useEffect, useRef, useState } from "react";

import styles from "./VideoSection.module.css";
import LocalVideo from "./LocalVideo";

interface VideoSectionProps {
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    hasControl: boolean;
    onToggleAudio: () => void;
    onToggleVideo: () => void;
    isAudioEnabled: boolean;
    isVideoEnabled: boolean;
}

export function VideoSection({
    localStream,
    remoteStream,
    hasControl,
    onToggleAudio,
    onToggleVideo,
    isAudioEnabled,
    isVideoEnabled,
}: VideoSectionProps) {
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const [showEnableAudio, setShowEnableAudio] = useState(false);

    // Attach remote stream to video element
    useEffect(() => {
        const remoteVideoElement = remoteVideoRef.current;

        if (!remoteVideoElement) {
            return;
        }

        if (!remoteStream) {
            remoteVideoElement.srcObject = null;
            setShowEnableAudio(false);
            return;
        }

        remoteVideoElement.srcObject = remoteStream;

        const playRemoteVideo = async () => {
            try {
                remoteVideoElement.muted = false;
                await remoteVideoElement.play();
                setShowEnableAudio(false);
            } catch (playError) {
                // Autoplay with audio is often blocked by browsers, so we
                // catch the error and show an option to enable audio

                console.warn(
                    "Remote autoplay with audio blocked, retrying muted:",
                    playError,
                );
                remoteVideoElement.muted = true;
                try {
                    await remoteVideoElement.play();
                    setShowEnableAudio(true);
                } catch (mutedPlayError) {
                    console.error(
                        "Failed to autoplay remote video even when muted:",
                        mutedPlayError,
                    );
                    setShowEnableAudio(false);
                }
            }
        };

        void playRemoteVideo();
    }, [remoteStream]);

    const handleEnableAudio = useCallback(async () => {
        const remoteVideoElement = remoteVideoRef.current;
        if (!remoteVideoElement) {
            return;
        }

        remoteVideoElement.muted = false;
        try {
            await remoteVideoElement.play();
            setShowEnableAudio(false);
        } catch (error) {
            console.warn("Remote audio is still blocked:", error);
            setShowEnableAudio(true);
        }
    }, []);

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
                    {showEnableAudio && (
                        <button
                            type="button"
                            className={styles.enableAudioButton}
                            onClick={() => {
                                void handleEnableAudio();
                            }}
                        >
                            Enable audio
                        </button>
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
