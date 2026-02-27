import { useEffect, useRef } from "react";

import styles from "./LocalVideo.module.css";
import { LocalVideoControls } from "./LocalVideoControls";
import type { LocalVideoControlsProps } from "./LocalVideoControls";

interface LocalVideoProps extends LocalVideoControlsProps {
    localStream: MediaStream | null;
}

export default function LocalVideo({
    localStream,
    onToggleAudio,
    onToggleVideo,
    isAudioEnabled,
    isVideoEnabled,
}: LocalVideoProps) {
    const localVideoRef = useRef<HTMLVideoElement>(null);

    // Attach local stream to video element
    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    return (
        <div className={styles.localVideoWrapper}>
            <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={styles.localVideo}
            />
            <LocalVideoControls
                onToggleAudio={onToggleAudio}
                onToggleVideo={onToggleVideo}
                isAudioEnabled={isAudioEnabled}
                isVideoEnabled={isVideoEnabled}
            />
        </div>
    );
}
