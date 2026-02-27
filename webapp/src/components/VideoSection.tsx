import { useCallback, useEffect, useRef, useState } from "react";

import styles from "./VideoSection.module.css";
import LocalVideo from "./LocalVideo";
import RequestControlButton from "./RequestControlButton";

interface VideoSectionProps {
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;

    hasControl: boolean;
    onRequestControl: () => void;
    isAudioEnabled: boolean;
    onToggleAudio: () => void;
    isVideoEnabled: boolean;
    onToggleVideo: () => void;
}

export function VideoSection({
    localStream,
    remoteStream,
    hasControl,
    onRequestControl,
    isAudioEnabled,
    onToggleAudio,
    isVideoEnabled,
    onToggleVideo,
}: VideoSectionProps) {
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const [isRemoteAudioMuted, setIsRemoteAudioMuted] = useState(true);

    // Attach remote stream to video element
    useEffect(() => {
        const remoteVideoElement = remoteVideoRef.current;

        if (!remoteVideoElement) {
            return;
        }

        if (!remoteStream) {
            remoteVideoElement.srcObject = null;
            return;
        }

        remoteVideoElement.srcObject = remoteStream;
        remoteVideoElement.muted = true;

        const playRemoteVideo = async () => {
            try {
                await remoteVideoElement.play();
            } catch (playError) {
                console.error("Failed to autoplay remote video:", playError);
            }
        };

        void playRemoteVideo();
    }, [remoteStream]);

    useEffect(() => {
        const remoteVideoElement = remoteVideoRef.current;
        if (!remoteVideoElement) {
            return;
        }

        remoteVideoElement.muted = isRemoteAudioMuted;
    }, [isRemoteAudioMuted]);

    const handleToggleRemoteAudio = useCallback(async () => {
        const remoteVideoElement = remoteVideoRef.current;
        if (!remoteVideoElement) {
            return;
        }

        const nextMutedState = !isRemoteAudioMuted;
        remoteVideoElement.muted = nextMutedState;
        setIsRemoteAudioMuted(nextMutedState);

        if (!nextMutedState) {
            try {
                await remoteVideoElement.play();
            } catch (error) {
                console.warn("Remote audio could not be enabled:", error);
                remoteVideoElement.muted = true;
                setIsRemoteAudioMuted(true);
            }
        }
    }, [isRemoteAudioMuted]);

    const handleRequestControl = useCallback(() => {
        onRequestControl();
        if (!isAudioEnabled) {
            onToggleAudio();
        }
        if (!isVideoEnabled) {
            onToggleVideo();
        }
        if (isRemoteAudioMuted) {
            handleToggleRemoteAudio();
        }
    }, [
        onRequestControl,
        onToggleAudio,
        onToggleVideo,
        isAudioEnabled,
        isVideoEnabled,
        isRemoteAudioMuted,
    ]);

    const statusText = remoteStream ? "" : "Waiting for peer...";

    return (
        <div className={styles.section}>
            <div className={styles.videoContainer}>
                <div className={styles.videoWrapper}>
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        muted={isRemoteAudioMuted}
                        className={styles.video}
                    />
                    <div className={styles.videoLabel}>Remote Video</div>
                    {statusText && (
                        <div className={styles.connectionStatus}>
                            {statusText}
                        </div>
                    )}
                    <button
                        type="button"
                        className={styles.enableAudioButton}
                        onClick={() => {
                            void handleToggleRemoteAudio();
                        }}
                    >
                        {isRemoteAudioMuted ? "Unmute audio" : "Mute audio"}
                    </button>
                </div>
                {!hasControl && (
                    <RequestControlButton onClick={handleRequestControl} />
                )}
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
