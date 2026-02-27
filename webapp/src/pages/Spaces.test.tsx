import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Spaces } from "./Spaces";
import * as useSpacesModule from "@/hooks/useSpaces";

vi.mock("@/hooks/useSpaces");

const lobby = {
    id: "lobby",
    display_name: "Lobby",
    description: "General meeting space",
    image_url: "/images/lobby.jpg",
    max_participants: 2,
    enabled: true,
};

describe("Spaces", () => {
    it("navigates to selected space", async () => {
        const user = userEvent.setup();
        const onSelectSpace = vi.fn();

        vi.mocked(useSpacesModule.useSpaces).mockReturnValue({
            spaces: [lobby],
            enabledSpaces: [lobby],
            loading: false,
            error: null,
            refetch: vi.fn(),
        });

        render(<Spaces onSelectSpace={onSelectSpace} />);

        await user.click(screen.getByRole("button", { name: /lobby/i }));

        expect(onSelectSpace).toHaveBeenCalledWith("lobby");
    });
});
