import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import { useSpace } from "./useSpace";

describe("useSpace", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("fetches a single space by id", async () => {
        const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
            ok: true,
            json: () =>
                Promise.resolve({
                    id: "lobby",
                    display_name: "Lobby",
                    description: "General meeting space",
                    image_url: "/images/lobby.jpg",
                    max_participants: 2,
                    enabled: true,
                }),
        } as Response);

        const { result } = renderHook(() => useSpace("lobby"));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(result.current.space?.id).toBe("lobby");
        expect(result.current.error).toBeNull();
    });

    it("handles failed requests", async () => {
        vi.spyOn(global, "fetch").mockResolvedValue({
            ok: false,
            statusText: "Not Found",
        } as Response);

        const { result } = renderHook(() => useSpace("missing"));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.space).toBeNull();
        expect(result.current.error).toContain("Failed to fetch space");
    });
});
