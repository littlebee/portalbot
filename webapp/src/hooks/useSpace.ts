import { useCallback, useEffect, useState } from "react";

import type { Space } from "@/types/space";
import { getRestApiBaseUrl } from "@/services/webrtc-config";

interface UseSpaceReturn {
    space: Space | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

export function useSpace(spaceId: string | null | undefined): UseSpaceReturn {
    const [space, setSpace] = useState<Space | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSpace = useCallback(async () => {
        const trimmedSpaceId = spaceId?.trim();

        if (!trimmedSpaceId) {
            setSpace(null);
            setError("Space ID is required");
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `${getRestApiBaseUrl()}/spaces/${encodeURIComponent(trimmedSpaceId)}`,
            );

            if (!response.ok) {
                throw new Error(
                    `Failed to fetch space: ${response.statusText}`,
                );
            }

            const data: Space = await response.json();
            setSpace(data);
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : "Unknown error occurred";
            setError(errorMessage);
            setSpace(null);
            console.error("Error fetching space:", err);
        } finally {
            setLoading(false);
        }
    }, [spaceId]);

    useEffect(() => {
        const trimmedSpaceId = spaceId?.trim();

        if (!trimmedSpaceId) {
            setSpace(null);
            setError("Space ID is required");
            setLoading(false);
            return;
        }

        const abortController = new AbortController();

        const fetchSpaceWithAbort = async () => {
            setLoading(true);
            setError(null);

            try {
                const response = await fetch(
                    `${getRestApiBaseUrl()}/spaces/${encodeURIComponent(trimmedSpaceId)}`,
                    { signal: abortController.signal },
                );

                if (!response.ok) {
                    throw new Error(
                        `Failed to fetch space: ${response.statusText}`,
                    );
                }

                const data: Space = await response.json();
                setSpace(data);
            } catch (err) {
                if (abortController.signal.aborted) {
                    return;
                }

                const errorMessage =
                    err instanceof Error
                        ? err.message
                        : "Unknown error occurred";
                setError(errorMessage);
                setSpace(null);
                console.error("Error fetching space:", err);
            } finally {
                if (!abortController.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        void fetchSpaceWithAbort();

        return () => {
            abortController.abort();
        };
    }, [spaceId]);

    return {
        space,
        loading,
        error,
        refetch: fetchSpace,
    };
}
