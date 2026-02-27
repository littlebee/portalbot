import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Space } from "./Space";
import { useSpace } from "@/hooks/useSpace";
import { useWebRTC } from "@/hooks/useWebRTC";

vi.mock("@/hooks/useSpace");
vi.mock("@/hooks/useWebRTC");

const mockUseWebRTCReturn = {
    viewPeer: null,
    controlPeer: null,
    connectionStatus: "connected",
    statusText: "Connected",
    clientId: "client-id",
    currentSpace: null,
    ws: {} as WebSocket,
    localStream: null,
    remoteStream: null,
    isAudioEnabled: true,
    isVideoEnabled: true,
    hasControl: false,
    isControlRequestPending: false,
    error: null,
    joinSpace: vi.fn(),
    leaveSpace: vi.fn(),
    requestControl: vi.fn(),
    toggleAudio: vi.fn(),
    toggleVideo: vi.fn(),
    clearError: vi.fn(),
};

describe("Space", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        vi.mocked(useSpace).mockReturnValue({
            space: {
                id: "lobby",
                display_name: "Lobby",
                description: "General meeting space",
                image_url: "/images/lobby.jpg",
                max_participants: 2,
                enabled: true,
            },
            loading: false,
            error: null,
            refetch: vi.fn(),
        });

        vi.mocked(useWebRTC).mockReturnValue(mockUseWebRTCReturn as any);
    });

    it("auto-joins the route space", async () => {
        render(<Space spaceId="lobby" />);

        await waitFor(() => {
            expect(mockUseWebRTCReturn.joinSpace).toHaveBeenCalledWith("lobby");
        });
    });

    it("leaves space and exits route", async () => {
        const user = userEvent.setup();
        const onExitSpace = vi.fn();

        render(<Space spaceId="lobby" onExitSpace={onExitSpace} />);

        await user.click(screen.getByRole("button"));

        expect(mockUseWebRTCReturn.leaveSpace).toHaveBeenCalled();
        expect(onExitSpace).toHaveBeenCalled();
    });
});
