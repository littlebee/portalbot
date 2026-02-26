import styles from "./StreamingControls.module.css";

interface StreamingControlsProps {
    hasControl: boolean;
    isControlRequestPending: boolean;
    onRequestControl: () => void;
    onToggleAudio: () => void;
    onToggleVideo: () => void;
    onLeave: () => void;
    isAudioEnabled: boolean;
    isVideoEnabled: boolean;
}

export default function StreamingControls({
    hasControl,
    isControlRequestPending,
    onRequestControl,
    onToggleAudio,
    onToggleVideo,
    onLeave,
    isAudioEnabled,
    isVideoEnabled,
}: StreamingControlsProps) {
    return (
        <div className={styles.controls}>
            {!hasControl && (
                <button
                    onClick={onRequestControl}
                    disabled={isControlRequestPending}
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    title="Request control of the robot"
                >
                    <span className={styles.icon}>🕹️</span>
                    <span className={styles.label}>
                        {isControlRequestPending
                            ? "Teleporting..."
                            : "Teleport"}
                    </span>
                </button>
            )}
            {hasControl && (
                <>
                    <button
                        onClick={onToggleAudio}
                        className={`${styles.btn} ${styles.btnControl} ${!isAudioEnabled ? styles.muted : ""}`}
                        title="Toggle Audio"
                    >
                        <span className={styles.icon}>
                            {isAudioEnabled ? "🎤" : "🔇"}
                        </span>
                        <span className={styles.label}>
                            {isAudioEnabled ? "Audio On" : "Audio Off"}
                        </span>
                    </button>
                    <button
                        onClick={onToggleVideo}
                        className={`${styles.btn} ${styles.btnControl} ${!isVideoEnabled ? styles.muted : ""}`}
                        title="Toggle Video"
                    >
                        <span className={styles.icon}>
                            {isVideoEnabled ? "📹" : "📵"}
                        </span>
                        <span className={styles.label}>
                            {isVideoEnabled ? "Video On" : "Video Off"}
                        </span>
                    </button>
                </>
            )}
            <button
                onClick={onLeave}
                className={`${styles.btn} ${styles.btnDanger}`}
                title="Leave Space"
            >
                <span className={styles.icon}>📞</span>
                <span className={styles.label}>Leave</span>
            </button>
        </div>
    );
}
