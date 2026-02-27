import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import VideoSection from "./VideoSection";

describe("VideoSection", () => {
    it("always shows audio mute/unmute control", () => {
        render(
            <VideoSection
                localStream={null}
                remoteStream={null}
                hasControl={false}
                onToggleAudio={vi.fn()}
                onToggleVideo={vi.fn()}
                isAudioEnabled={true}
                isVideoEnabled={true}
            />,
        );

        expect(
            screen.getByRole("button", { name: /unmute audio/i }),
        ).toBeInTheDocument();
    });

    it("starts with remote audio muted on initial render", () => {
        const playMock = vi
            .spyOn(HTMLMediaElement.prototype, "play")
            .mockResolvedValue(undefined);

        try {
            const { container } = render(
                <VideoSection
                    localStream={null}
                    remoteStream={new MediaStream()}
                    hasControl={false}
                    onToggleAudio={vi.fn()}
                    onToggleVideo={vi.fn()}
                    isAudioEnabled={true}
                    isVideoEnabled={true}
                />,
            );

            const remoteVideo = container.querySelector("video");

            expect(playMock).toHaveBeenCalled();
            expect(remoteVideo).not.toBeNull();
            expect(remoteVideo?.muted).toBe(true);
            expect(
                screen.getByRole("button", { name: /unmute audio/i }),
            ).toBeInTheDocument();
        } finally {
            playMock.mockRestore();
        }
    });
});
