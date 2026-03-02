import cx from "classnames";

import styles from "./IconToggleButton.module.css";

interface IconToggleButtonProps {
    onToggle: () => void;
    isEnabled: boolean;
    iconOn: React.ReactNode;
    iconOff: React.ReactNode;
    textOn?: string;
    textOff?: string;
    title?: string;
}

export default function IconToggleButton({
    onToggle,
    isEnabled,
    iconOn,
    iconOff,
    textOn,
    textOff,
    title,
}: IconToggleButtonProps) {
    return (
        <div>
            <button
                onClick={onToggle}
                className={cx(styles.btn, styles.btnControl, {
                    [styles.muted]: !isEnabled,
                })}
                title={title}
            >
                <span className={styles.icon}>
                    {isEnabled ? iconOn : iconOff}
                </span>
                {textOn && textOff && (
                    <span className={styles.label}>
                        {isEnabled ? textOn : textOff}
                    </span>
                )}
            </button>
        </div>
    );
}
