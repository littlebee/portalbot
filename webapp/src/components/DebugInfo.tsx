import styles from "./DebugInfo.module.css";

interface DebugInfoProps {
    connectionStatus: string;
}

export default function DebugInfo({ connectionStatus }: DebugInfoProps) {
    return (
        <div className={styles.section}>
            <details className={styles.details}>
                <summary className={styles.summary}>Connection Info</summary>
                <div className={styles.debugInfo}>
                    <div className={styles.debugRow}>
                        <strong>Connection Status:</strong>
                        <span>{connectionStatus}</span>
                    </div>
                </div>
            </details>
        </div>
    );
}
