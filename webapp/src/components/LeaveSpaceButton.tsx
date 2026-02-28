import ExitSignIcon from "./icons/ExitSignIcon";
import styles from "./LeaveSpaceButton.module.css";

interface LeaveSpaceButtonProps {
    onLeave: () => void;
}

export function LeaveSpaceButton({ onLeave }: LeaveSpaceButtonProps) {
    return (
        <button
            className={styles.leaveButton}
            onClick={onLeave}
            aria-label="Leave space"
        >
            <ExitSignIcon />
        </button>
    );
}

export default LeaveSpaceButton;
