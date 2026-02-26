import styles from "./StatusBar.module.css";
import type { ConnectionStatus } from "@/types/webrtc";

interface StatusBarProps {
    status: ConnectionStatus;
    statusText: string;
    spaceName?: string | null;
}

export default function StatusBar({
    status,
    statusText,
    spaceName,
}: StatusBarProps) {
    return (
        <div className={styles.statusBar}>
            <span className={`${styles.statusIndicator} ${styles[status]}`}>
                {statusText}
            </span>
            {spaceName && (
                <span className={styles.spaceInfo}>Space: {spaceName}</span>
            )}
        </div>
    );
}
