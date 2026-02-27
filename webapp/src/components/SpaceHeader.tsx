import LeaveSpaceButton from "./LeaveSpaceButton";
import styles from "./RootHeader.module.css";

import type { Space } from "@/types/space";

export interface SpaceHeaderProps {
    space?: Space;
    onLeave: () => void;
}

export function SpaceHeader({ space, onLeave }: SpaceHeaderProps) {
    return !space ? (
        <div className={styles.titles}>
            <h1 className={styles.title}>Joining space...</h1>
            <p className={styles.subtitle}>
                Please wait while we connect you to the space.
            </p>
        </div>
    ) : (
        <>
            <LeaveSpaceButton onLeave={onLeave} />
            <img
                className={styles.logo}
                src={space.image_url}
                alt={space.display_name}
            />

            <div className={styles.titles}>
                <h1 className={styles.title}>{space.display_name}</h1>
                <p className={styles.subtitle}>
                    {space.description || "No description available."}
                </p>
            </div>
        </>
    );
}
