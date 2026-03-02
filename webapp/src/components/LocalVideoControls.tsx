import IconToggleButton from "./IconToggleButton";
import MicrophoneOffIcon from "./icons/MicrophoneOffIcon";
import MicrophoneOnIcon from "./icons/MicrophoneOnIcon";
import VideoOffIcon from "./icons/VideoOffIcon";
import VideoOnIcon from "./icons/VideoOnIcon";
import styles from "./LocalVideoControls.module.css";

export interface LocalVideoControlsProps {
    onToggleAudio: () => void;
    onToggleVideo: () => void;
    isAudioEnabled: boolean;
    isVideoEnabled: boolean;
}

export function LocalVideoControls({
    onToggleAudio,
    onToggleVideo,
    isAudioEnabled,
    isVideoEnabled,
}: LocalVideoControlsProps) {
    return (
        <div className={styles.controls}>
            <IconToggleButton
                onToggle={onToggleAudio}
                isEnabled={isAudioEnabled}
                iconOn={<MicrophoneOnIcon />}
                iconOff={<MicrophoneOffIcon />}
                title="Toggle Microphone"
            />
            <IconToggleButton
                onToggle={onToggleVideo}
                isEnabled={isVideoEnabled}
                iconOn={<VideoOnIcon />}
                iconOff={<VideoOffIcon />}
                title="Toggle Video"
            />
        </div>
    );
}
