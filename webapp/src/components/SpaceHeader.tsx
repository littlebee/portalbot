import cx from "classnames";

import LeaveSpaceButton from "./LeaveSpaceButton";

import rootStyles from "./RootHeader.module.css";
import styles from "./SpaceHeader.module.css";

import type { Space } from "@/types/space";

export interface SpaceHeaderProps {
    space?: Space;
    onLeave: () => void;
}

export function SpaceHeader({ space, onLeave }: SpaceHeaderProps) {
    return !space ? (
        <div className={rootStyles.titles}>
            <h1 className={rootStyles.title}>Joining space...</h1>
            <p className={rootStyles.subtitle}>
                Please wait while we connect you to the space.
            </p>
        </div>
    ) : (
        <>
            <LeaveSpaceButton onLeave={onLeave} />
            <img
                className={cx(rootStyles.logo, styles.logo)}
                src={space.image_url}
                alt={space.display_name}
            />

            <div className={rootStyles.titles}>
                <h1 className={rootStyles.title}>{space.display_name}</h1>
                <p className={rootStyles.subtitle}>
                    {space.description || "No description available."}
                </p>
            </div>
        </>
    );
}
