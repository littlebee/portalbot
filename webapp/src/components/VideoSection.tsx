import { useEffect, useRef } from "react";
import styles from "./VideoSection.module.css";

interface VideoSectionProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onLeave: () => void;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  connectionState: RTCPeerConnectionState;
}

export default function VideoSection({
  localStream,
  remoteStream,
  onToggleAudio,
  onToggleVideo,
  onLeave,
  isAudioEnabled,
  isVideoEnabled,
  connectionState,
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

  const getConnectionStatusText = () => {
    if (!remoteStream) {
      return "Waiting for peer...";
    }
    switch (connectionState) {
      case "connected":
        return null; // Don't show status when connected
      case "connecting":
        return "Connecting...";
      case "disconnected":
        return "Connection lost";
      case "failed":
        return "Connection failed";
      default:
        return "Waiting for peer...";
    }
  };

  const statusText = getConnectionStatusText();

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
            <div className={styles.connectionStatus}>{statusText}</div>
          )}
        </div>

        <div className={`${styles.videoWrapper} ${styles.local}`}>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={styles.video}
          />
          <div className={styles.videoLabel}>You</div>
        </div>
      </div>

      <div className={styles.controls}>
        <button
          onClick={onToggleAudio}
          className={`${styles.btn} ${styles.btnControl} ${!isAudioEnabled ? styles.muted : ""}`}
          title="Toggle Audio"
        >
          <span className={styles.icon}>{isAudioEnabled ? "🎤" : "🔇"}</span>
          <span className={styles.label}>
            {isAudioEnabled ? "Audio On" : "Audio Off"}
          </span>
        </button>
        <button
          onClick={onToggleVideo}
          className={`${styles.btn} ${styles.btnControl} ${!isVideoEnabled ? styles.muted : ""}`}
          title="Toggle Video"
        >
          <span className={styles.icon}>{isVideoEnabled ? "📹" : "📵"}</span>
          <span className={styles.label}>
            {isVideoEnabled ? "Video On" : "Video Off"}
          </span>
        </button>
        <button
          onClick={onLeave}
          className={`${styles.btn} ${styles.btnDanger}`}
          title="Leave Space"
        >
          <span className={styles.icon}>📞</span>
          <span className={styles.label}>Leave</span>
        </button>
      </div>
    </div>
  );
}
