import { useState } from "react";
import { updateSharedState } from "../util/hubState";
import styles from "./WorthlessCounter.module.css";

interface WorthlessCounterProps {
    value?: number;
}

export function WorthlessCounter({ value }: WorthlessCounterProps) {
    const [intervalInput, setIntervalInput] = useState<string>("1.0");

    const handleIntervalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setIntervalInput(value);
        const numValue = parseFloat(value);
        if (!isNaN(numValue) && numValue > 0) {
            updateSharedState({ worthless_counter_interval: numValue });
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.label}>Worthless Counter</div>
            <div className={styles.counter} key={value}>
                {value ?? "—"}
            </div>
            <div className={styles.intervalControl}>
                <label htmlFor="interval-input">
                    Update Interval (seconds):{" "}
                </label>
                <input
                    id="interval-input"
                    type="number"
                    value={intervalInput}
                    onChange={handleIntervalChange}
                    step="0.01"
                    min="0.01"
                    className={styles.intervalInput}
                />
            </div>
        </div>
    );
}