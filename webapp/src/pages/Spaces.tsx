import { useCallback } from "react";

import type { Space } from "@/types/space";
import styles from "@/App.module.css";
import { JoinSpace } from "@/components/JoinSpace";
import { RootHeader } from "@/components/RootHeader";

export interface SpacesProps {
    onSelectSpace?: (spaceId: string) => Promise<void> | void;
}

export function Spaces({ onSelectSpace }: SpacesProps) {
    const handleJoin = useCallback(
        (space: Space) => {
            void onSelectSpace?.(space.id);
        },
        [onSelectSpace],
    );

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <RootHeader />
            </header>
            <JoinSpace onJoin={handleJoin} />
        </div>
    );
}

export default Spaces;
