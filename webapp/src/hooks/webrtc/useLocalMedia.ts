import { useCallback, useRef, useState } from "react";

import { MEDIA_CONSTRAINTS } from "@/services/webrtc-config";

let globalLocalStream: MediaStream | null = null;

interface UseLocalMediaOptions {
    showError: (message: string) => void;
    onGetLocalStreamError?: () => void;
}

export function useLocalMedia({
    showError,
    onGetLocalStreamError,
}: UseLocalMediaOptions): {
    localStream: MediaStream | null;
    isAudioEnabled: boolean;
    isVideoEnabled: boolean;
    getLocalStream: () => Promise<MediaStream>;
    stopLocalMedia: () => void;
    toggleAudio: () => void;
    toggleVideo: () => void;
} {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);

    const localStreamRef = useRef<MediaStream | null>(null);

    const stopLocalMedia = useCallback(() => {
        const streams = [localStreamRef.current, globalLocalStream].filter(
            (stream): stream is MediaStream => stream !== null,
        );
        const seenStreamIds = new Set<string>();

        streams.forEach((stream) => {
            if (seenStreamIds.has(stream.id)) {
                return;
            }

            seenStreamIds.add(stream.id);
            stream.getTracks().forEach((track) => track.stop());
        });

        localStreamRef.current = null;
        globalLocalStream = null;
        setLocalStream(null);
    }, []);

    const getLocalStream = useCallback(async (): Promise<MediaStream> => {
        try {
            let stream = localStreamRef.current ?? globalLocalStream;
            if (
                stream &&
                stream
                    .getTracks()
                    .every((track) => track.readyState === "ended")
            ) {
                stream = null;
            }

            if (!stream) {
                stream =
                    await navigator.mediaDevices.getUserMedia(
                        MEDIA_CONSTRAINTS,
                    );
                console.log("Obtained local media stream", stream);
                setLocalStream(stream);
                localStreamRef.current = stream;
                globalLocalStream = stream;
            }

            return stream;
        } catch (err) {
            onGetLocalStreamError?.();
            console.error("Error getting local media stream:", err);
            showError(
                `Failed to access camera/microphone: ${
                    err instanceof Error ? err.message : "Unknown error"
                }`,
            );
            throw err;
        }
    }, [onGetLocalStreamError, showError]);

    const toggleAudio = useCallback(() => {
        if (!localStream) {
            return;
        }

        const audioTrack = localStream.getAudioTracks()[0];
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
    }, [localStream]);

    const toggleVideo = useCallback(() => {
        if (!localStream) {
            return;
        }

        const videoTrack = localStream.getVideoTracks()[0];
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
    }, [localStream]);

    return {
        localStream,
        isAudioEnabled,
        isVideoEnabled,
        getLocalStream,
        stopLocalMedia,
        toggleAudio,
        toggleVideo,
    };
}
