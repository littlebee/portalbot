import styles from "./ConnectionTag.module.css";
import type { ConnectionStatus } from "@/types/webrtc";

interface ConnectionTagProps {
    status: ConnectionStatus;
    statusText: string;
}

export default function ConnectionTag({
    status,
    statusText,
}: ConnectionTagProps) {
    return (
        <div className={styles.container}>
            <div className={`${styles.statusIndicator} ${styles[status]}`}>
                {statusText}
            </div>
        </div>
    );
}
