import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import JoinSpace from "./JoinSpace";
import * as useSpacesModule from "@/hooks/useSpaces";

// Mock the useSpaces hook
vi.mock("@/hooks/useSpaces");

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
        id: "robot-1",
        display_name: "Robot 1",
        description: "Connect to Robot 1",
        image_url: "/images/robot-1.jpg",
        max_participants: 2,
        enabled: true,
    },
    {
        id: "robot-2",
        display_name: "Robot 2",
        description: "Connect to Robot 2",
        image_url: "/images/robot-2.jpg",
        max_participants: 2,
        enabled: false,
    },
];

describe("JoinSpace", () => {
    const mockOnJoin = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("shows loading state while fetching spaces", () => {
        vi.mocked(useSpacesModule.useSpaces).mockReturnValue({
            spaces: [],
            enabledSpaces: [],
            loading: true,
            error: null,
            refetch: vi.fn(),
        });

        render(<JoinSpace onJoin={mockOnJoin} />);

        expect(
            screen.getByText(/loading available spaces/i),
        ).toBeInTheDocument();
    });

    it("shows error message when spaces fail to load", () => {
        vi.mocked(useSpacesModule.useSpaces).mockReturnValue({
            spaces: [],
            enabledSpaces: [],
            loading: false,
            error: "Failed to fetch spaces",
            refetch: vi.fn(),
        });

        render(<JoinSpace onJoin={mockOnJoin} />);

        expect(screen.getByText(/error loading spaces/i)).toBeInTheDocument();
        expect(screen.getByText(/failed to fetch spaces/i)).toBeInTheDocument();
    });

    it("shows message when no spaces are available", () => {
        vi.mocked(useSpacesModule.useSpaces).mockReturnValue({
            spaces: [],
            enabledSpaces: [],
            loading: false,
            error: null,
            refetch: vi.fn(),
        });

        render(<JoinSpace onJoin={mockOnJoin} />);

        expect(
            screen.getByText(/no spaces are currently available/i),
        ).toBeInTheDocument();
    });

    it("renders space list with enabled spaces", () => {
        const enabledSpaces = mockSpaces.filter((space) => space.enabled);

        vi.mocked(useSpacesModule.useSpaces).mockReturnValue({
            spaces: mockSpaces,
            enabledSpaces,
            loading: false,
            error: null,
            refetch: vi.fn(),
        });

        render(<JoinSpace onJoin={mockOnJoin} />);

        expect(screen.getByText("Lobby")).toBeInTheDocument();
        expect(screen.getByText("General meeting space")).toBeInTheDocument();
        expect(screen.getByText("Robot 1")).toBeInTheDocument();
        expect(screen.getByText("Connect to Robot 1")).toBeInTheDocument();
        // Robot 2 should not be in the list (disabled)
        expect(screen.queryByText("Robot 2")).not.toBeInTheDocument();
    });

    it("displays space images and details in list", async () => {
        const enabledSpaces = mockSpaces.filter((space) => space.enabled);

        vi.mocked(useSpacesModule.useSpaces).mockReturnValue({
            spaces: mockSpaces,
            enabledSpaces,
            loading: false,
            error: null,
            refetch: vi.fn(),
        });

        render(<JoinSpace onJoin={mockOnJoin} />);

        await waitFor(() => {
            expect(screen.getByAltText("Lobby")).toBeInTheDocument();
            expect(screen.getByAltText("Robot 1")).toBeInTheDocument();
            expect(screen.getAllByText(/max 2 participants/i)).toHaveLength(2);
        });
    });

    it("calls onJoin when a space card is clicked", async () => {
        const user = userEvent.setup();
        const enabledSpaces = mockSpaces.filter((space) => space.enabled);

        vi.mocked(useSpacesModule.useSpaces).mockReturnValue({
            spaces: mockSpaces,
            enabledSpaces,
            loading: false,
            error: null,
            refetch: vi.fn(),
        });

        render(<JoinSpace onJoin={mockOnJoin} />);

        const lobbyCard = screen.getByRole("button", { name: /lobby/i });
        await user.click(lobbyCard);

        await waitFor(() => {
            expect(mockOnJoin).toHaveBeenCalledWith(enabledSpaces[0]);
        });
    });

    it("displays space cards as enabled buttons", () => {
        const enabledSpaces = mockSpaces.filter((space) => space.enabled);

        vi.mocked(useSpacesModule.useSpaces).mockReturnValue({
            spaces: mockSpaces,
            enabledSpaces,
            loading: false,
            error: null,
            refetch: vi.fn(),
        });

        render(<JoinSpace onJoin={mockOnJoin} />);

        const lobbyCard = screen.getByRole("button", { name: /lobby/i });
        const robot1Card = screen.getByRole("button", { name: /robot 1/i });

        expect(lobbyCard).not.toBeDisabled();
        expect(robot1Card).not.toBeDisabled();
    });

    it("disables space cards when disabled prop is true", () => {
        const enabledSpaces = mockSpaces.filter((space) => space.enabled);

        vi.mocked(useSpacesModule.useSpaces).mockReturnValue({
            spaces: mockSpaces,
            enabledSpaces,
            loading: false,
            error: null,
            refetch: vi.fn(),
        });

        render(<JoinSpace onJoin={mockOnJoin} disabled={true} />);

        const lobbyCard = screen.getByRole("button", { name: /lobby/i });
        const robot1Card = screen.getByRole("button", { name: /robot 1/i });

        expect(lobbyCard).toBeDisabled();
        expect(robot1Card).toBeDisabled();
    });

    it("shows joining state while onJoin is in progress", async () => {
        const user = userEvent.setup();
        const enabledSpaces = mockSpaces.filter((space) => space.enabled);

        vi.mocked(useSpacesModule.useSpaces).mockReturnValue({
            spaces: mockSpaces,
            enabledSpaces,
            loading: false,
            error: null,
            refetch: vi.fn(),
        });

        render(<JoinSpace onJoin={mockOnJoin} />);

        const lobbyCard = screen.getByRole("button", { name: /lobby/i });
        await user.click(lobbyCard);

        expect(mockOnJoin).toHaveBeenCalledWith(enabledSpaces[0]);
    });
});
