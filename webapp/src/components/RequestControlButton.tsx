import styles from "./RequestControlButton.module.css";

interface RequestControlButtonProps {
    onClick: () => void;
}

export function RequestControlButton({ onClick }: RequestControlButtonProps) {
    return (
        <button
            className={styles.requestControlButton}
            title="Click to request control of the robot"
            onClick={onClick}
        >
            Request Control
        </button>
    );
}

export default RequestControlButton;
