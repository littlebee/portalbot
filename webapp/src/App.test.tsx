/**
 * Integration tests for the App component
 * Tests the main application flow including space joining, video chat, and error handling
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { WebRTCPeer } from "./services/webrtcPeer";
import type { UseWebRTCReturn } from "@/hooks/useWebRTC";
import { useWebRTC } from "@/hooks/useWebRTC";
import * as useSpacesModule from "@/hooks/useSpaces";

// Mock the useWebRTC hook
vi.mock("@/hooks/useWebRTC");
// Mock the useSpaces hook
vi.mock("@/hooks/useSpaces");

describe("App Integration Tests", () => {
    // Default mock values for useWebRTC hook
    const mockWebRTC: UseWebRTCReturn = {
        viewPeer: new WebRTCPeer("test-view-peer", () => {}),
        controlPeer: new WebRTCPeer("test-control-peer", () => {}),
        connectionStatus: "connected",
        statusText: "Connected to server",
        clientId: "test-client-id",
        currentSpace: null,
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

    // Mock spaces data
    const mockSpaces = [
        {
            id: "lobby",
            display_name: "Lobby",
            description: "General meeting space",
            image_url: "/images/lobby.jpg",
            max_participants: 2,
            enabled: true,
        },
        {
            id: "test-space",
            display_name: "Test Space",
            description: "Test space for testing",
            image_url: "/images/test.jpg",
            max_participants: 2,
            enabled: true,
        },
    ];

    beforeEach(() => {
        // Reset all mocks before each test
        vi.clearAllMocks();

        // Setup default mock implementation
        vi.mocked(useWebRTC).mockReturnValue(mockWebRTC);

        // Setup default spaces mock
        vi.mocked(useSpacesModule.useSpaces).mockReturnValue({
            spaces: mockSpaces,
            enabledSpaces: mockSpaces,
            loading: false,
            error: null,
            refetch: vi.fn(),
        });
    });

    describe("Initial Render", () => {
        it("should render the app header with title and subtitle", () => {
            render(<App />);

            expect(screen.getByText("Portalbot")).toBeInTheDocument();
            expect(
                screen.getByText("Secure Video Chat with TURN Server Support"),
            ).toBeInTheDocument();
        });

        it("should render StatusBar with connection status", () => {
            render(<App />);

            expect(screen.getByText("Connected to server")).toBeInTheDocument();
        });

        it("should render JoinSpace component when not in a space", () => {
            render(<App />);

            // Should show the join space interface with space list
            expect(screen.getByText("Join a Space")).toBeInTheDocument();
            expect(screen.getByText("Lobby")).toBeInTheDocument();
            expect(screen.getByText("Test Space")).toBeInTheDocument();
        });

        it("should not render VideoSection when not in a space", () => {
            render(<App />);

            // VideoSection should not be visible
            expect(screen.queryByText(/^you$/i)).not.toBeInTheDocument();
            expect(screen.queryByText(/remote video/i)).not.toBeInTheDocument();
        });
    });

    describe("Joining a Space", () => {
        it("should call joinSpace when user clicks a space card", async () => {
            const user = userEvent.setup();
            const mockJoinSpace = vi.fn();

            vi.mocked(useWebRTC).mockReturnValue({
                ...mockWebRTC,
                joinSpace: mockJoinSpace,
            });

            render(<App />);

            const testSpaceCard = screen.getByRole("button", {
                name: /test space/i,
            });
            await user.click(testSpaceCard);

            expect(mockJoinSpace).toHaveBeenCalledWith("test-space");
        });

        it("should render VideoSection when in a space", () => {
            vi.mocked(useWebRTC).mockReturnValue({
                ...mockWebRTC,
                currentSpace: "test-space",
            });

            render(<App />);

            // VideoSection should be visible
            expect(screen.getByText(/remote video/i)).toBeInTheDocument();
            expect(
                screen.getByRole("button", { name: /teleport/i }),
            ).toBeInTheDocument();
            expect(screen.queryByText(/^you$/i)).not.toBeInTheDocument();
            // Space list should not be visible
            expect(screen.queryByText("Join a Space")).not.toBeInTheDocument();
        });

        it("should render DebugInfo when in a space", async () => {
            vi.mocked(useWebRTC).mockReturnValue({
                ...mockWebRTC,
                currentSpace: "test-space",
                connectionStatus: "connected",
            });

            render(<App />);

            // DebugInfo should show connection states
            const connectedElements = await screen.findAllByText(/connected/i);
            expect(connectedElements.length).toBeGreaterThan(0);
        });
    });

    describe("Video Controls", () => {
        it("should call toggleAudio when audio button is clicked", async () => {
            const user = userEvent.setup();
            const mockToggleAudio = vi.fn();

            vi.mocked(useWebRTC).mockReturnValue({
                ...mockWebRTC,
                currentSpace: "test-space",
                hasControl: true,
                toggleAudio: mockToggleAudio,
            });

            render(<App />);

            const audioButton = screen.getByRole("button", {
                name: /audio on/i,
            });
            await user.click(audioButton);

            expect(mockToggleAudio).toHaveBeenCalled();
        });

        it("should call toggleVideo when video button is clicked", async () => {
            const user = userEvent.setup();
            const mockToggleVideo = vi.fn();

            vi.mocked(useWebRTC).mockReturnValue({
                ...mockWebRTC,
                currentSpace: "test-space",
                hasControl: true,
                toggleVideo: mockToggleVideo,
            });

            render(<App />);

            const videoButton = screen.getByRole("button", {
                name: /video on/i,
            });
            await user.click(videoButton);

            expect(mockToggleVideo).toHaveBeenCalled();
        });

        it("should call leaveSpace when leave button is clicked", async () => {
            const user = userEvent.setup();
            const mockLeaveSpace = vi.fn();

            vi.mocked(useWebRTC).mockReturnValue({
                ...mockWebRTC,
                currentSpace: "test-space",
                leaveSpace: mockLeaveSpace,
            });

            render(<App />);

            const leaveButton = screen.getByRole("button", { name: /leave/i });
            await user.click(leaveButton);

            expect(mockLeaveSpace).toHaveBeenCalled();
        });

        it("should call requestControl when teleport button is clicked", async () => {
            const user = userEvent.setup();
            const mockRequestControl = vi.fn();

            vi.mocked(useWebRTC).mockReturnValue({
                ...mockWebRTC,
                currentSpace: "test-space",
                requestControl: mockRequestControl,
            });

            render(<App />);

            const teleportButton = screen.getByRole("button", {
                name: /teleport/i,
            });
            await user.click(teleportButton);

            expect(mockRequestControl).toHaveBeenCalled();
        });

        it("should disable teleport button while control request is pending", () => {
            vi.mocked(useWebRTC).mockReturnValue({
                ...mockWebRTC,
                currentSpace: "test-space",
                isControlRequestPending: true,
            });

            render(<App />);

            expect(
                screen.getByRole("button", { name: /teleporting/i }),
            ).toBeDisabled();
        });
    });

    describe("Error Handling", () => {
        it("should display error message when error is present", () => {
            const errorMessage = "Failed to connect to server";

            vi.mocked(useWebRTC).mockReturnValue({
                ...mockWebRTC,
                error: errorMessage,
            });

            render(<App />);

            expect(screen.getByText(errorMessage)).toBeInTheDocument();
        });

        it("should not display error message when error is null", () => {
            render(<App />);

            // Error container should not be visible
            const errorElements = screen.queryAllByText(/failed|error/i);
            expect(errorElements).toHaveLength(0);
        });

        it("should show connection error in error container", () => {
            vi.mocked(useWebRTC).mockReturnValue({
                ...mockWebRTC,
                error: "WebSocket connection failed",
            });

            render(<App />);

            expect(
                screen.getByText("WebSocket connection failed"),
            ).toBeInTheDocument();
        });
    });

    describe("Connection Status", () => {
        it("should display disconnected status", () => {
            vi.mocked(useWebRTC).mockReturnValue({
                ...mockWebRTC,
                connectionStatus: "disconnected",
                statusText: "Disconnected",
            });

            render(<App />);

            expect(screen.getByText("Disconnected")).toBeInTheDocument();
        });

        it("should display connecting status", () => {
            vi.mocked(useWebRTC).mockReturnValue({
                ...mockWebRTC,
                connectionStatus: "connecting",
                statusText: "Connecting...",
            });

            render(<App />);

            expect(screen.getByText("Connecting...")).toBeInTheDocument();
        });

        it("should display connected status", () => {
            render(<App />);

            expect(screen.getByText("Connected to server")).toBeInTheDocument();
        });

        it("should display space name in status bar when in space", () => {
            vi.mocked(useWebRTC).mockReturnValue({
                ...mockWebRTC,
                currentSpace: "my-awesome-space",
            });

            render(<App />);

            expect(
                screen.getByText(/space:.*my-awesome-space/i),
            ).toBeInTheDocument();
        });
    });

    describe("Media Streams", () => {
        it("should pass local stream to VideoSection when available", () => {
            const mockStream = new MediaStream();

            vi.mocked(useWebRTC).mockReturnValue({
                ...mockWebRTC,
                currentSpace: "test-space",
                localStream: mockStream,
                hasControl: true,
            });

            render(<App />);

            // VideoSection should be rendered with local stream
            expect(screen.getByText(/^you$/i)).toBeInTheDocument();
        });

        it("should pass remote stream to VideoSection when available", () => {
            const mockStream = new MediaStream();

            vi.mocked(useWebRTC).mockReturnValue({
                ...mockWebRTC,
                currentSpace: "test-space",
                remoteStream: mockStream,
            });

            render(<App />);

            // VideoSection should be rendered with remote stream
            expect(screen.getByText(/remote video/i)).toBeInTheDocument();
        });
    });

    describe("Complete User Flow", () => {
        it("should handle complete flow: connect -> join space -> leave space", async () => {
            const user = userEvent.setup();
            const mockJoinSpace = vi.fn();
            const mockLeaveSpace = vi.fn();

            // Initial state: connected but not in space
            const mockHook = vi.mocked(useWebRTC);

            mockHook.mockReturnValue({
                ...mockWebRTC,
                joinSpace: mockJoinSpace,
                leaveSpace: mockLeaveSpace,
            });

            const { rerender } = render(<App />);

            // Step 1: User joins a space
            const testSpaceCard = screen.getByRole("button", {
                name: /test space/i,
            });
            await user.click(testSpaceCard);

            expect(mockJoinSpace).toHaveBeenCalledWith("test-space");

            // Step 2: Simulate being in the space
            mockHook.mockReturnValue({
                ...mockWebRTC,
                currentSpace: "test-space",
                joinSpace: mockJoinSpace,
                leaveSpace: mockLeaveSpace,
            });

            rerender(<App />);

            // Verify VideoSection is shown
            expect(screen.getByText(/remote video/i)).toBeInTheDocument();
            expect(
                screen.getByRole("button", { name: /teleport/i }),
            ).toBeInTheDocument();
            // Space list should not be visible
            expect(screen.queryByText("Join a Space")).not.toBeInTheDocument();

            // Step 3: User leaves the space
            const leaveButton = screen.getByRole("button", { name: /leave/i });
            await user.click(leaveButton);

            expect(mockLeaveSpace).toHaveBeenCalled();

            // Step 4: Simulate being back to not in space
            mockHook.mockReturnValue({
                ...mockWebRTC,
                currentSpace: null,
                joinSpace: mockJoinSpace,
                leaveSpace: mockLeaveSpace,
            });

            rerender(<App />);

            // Verify JoinSpace is shown again
            await waitFor(() => {
                expect(screen.getByText("Join a Space")).toBeInTheDocument();
            });
        });
    });

    describe("Route-Controlled Navigation", () => {
        it("should join the route space when routeSpaceId is provided", async () => {
            const mockJoinSpace = vi.fn().mockResolvedValue(undefined);
            vi.mocked(useWebRTC).mockReturnValue({
                ...mockWebRTC,
                joinSpace: mockJoinSpace,
            });

            render(<App routeSpaceId="test-space" />);

            await waitFor(() => {
                expect(mockJoinSpace).toHaveBeenCalledWith("test-space");
            });
        });

        it("should leave when routeSpaceId becomes null", async () => {
            const mockLeaveSpace = vi.fn();
            const mockHook = vi.mocked(useWebRTC);

            mockHook.mockReturnValue({
                ...mockWebRTC,
                currentSpace: "test-space",
                leaveSpace: mockLeaveSpace,
            });

            const { rerender } = render(<App routeSpaceId="test-space" />);

            rerender(<App routeSpaceId={null} />);

            await waitFor(() => {
                expect(mockLeaveSpace).toHaveBeenCalled();
            });
        });

        it("should use route callbacks for join and leave actions", async () => {
            const user = userEvent.setup();
            const onSelectSpace = vi.fn().mockResolvedValue(undefined);
            const onExitSpace = vi.fn();
            const mockLeaveSpace = vi.fn();

            vi.mocked(useWebRTC).mockReturnValue({
                ...mockWebRTC,
                currentSpace: null,
                joinSpace: vi.fn(),
                leaveSpace: mockLeaveSpace,
            });

            const { rerender } = render(
                <App routeSpaceId={null} onSelectSpace={onSelectSpace} />,
            );

            const testSpaceCard = screen.getByRole("button", {
                name: /test space/i,
            });
            await user.click(testSpaceCard);

            await waitFor(() => {
                expect(onSelectSpace).toHaveBeenCalledWith("test-space");
            });

            vi.mocked(useWebRTC).mockReturnValue({
                ...mockWebRTC,
                currentSpace: "test-space",
                joinSpace: vi.fn(),
                leaveSpace: mockLeaveSpace,
            });

            rerender(
                <App routeSpaceId="test-space" onExitSpace={onExitSpace} />,
            );
            const leaveButton = screen.getByRole("button", { name: /leave/i });
            await user.click(leaveButton);
            expect(mockLeaveSpace).toHaveBeenCalled();
            expect(onExitSpace).toHaveBeenCalled();
        });
    });
});
