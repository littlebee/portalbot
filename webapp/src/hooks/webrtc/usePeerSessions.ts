import { useCallback, useRef, useState } from "react";

import type {
    AnswerData,
    IceCandidateData,
    UserJoinedData,
    UserLeftData,
} from "@/types/webrtc";
import { WebRTCPeer } from "@/services/webrtcPeer";

interface UsePeerSessionsOptions {
    sendMessage: (type: string, data?: any) => void;
    showError: (message: string) => void;
    getCurrentSpace: () => string | null;
    getLocalStream: () => Promise<MediaStream>;
}

export function usePeerSessions({
    sendMessage,
    showError,
    getCurrentSpace,
    getLocalStream,
}: UsePeerSessionsOptions): {
    viewPeer: WebRTCPeer | null;
    controlPeer: WebRTCPeer | null;
    remoteStream: MediaStream | null;
    hasControl: boolean;
    isControlRequestPending: boolean;
    requestControl: () => void;
    sendOffer: () => Promise<void>;
    handleAnswer: (data: AnswerData) => Promise<void>;
    handleControlAnswer: (data: AnswerData) => Promise<void>;
    handleIceCandidate: (data: IceCandidateData) => Promise<void>;
    handleRobotJoined: (_data: UserJoinedData) => Promise<void>;
    handleRobotLeft: (_data: UserLeftData) => void;
    handleControlGranted: () => Promise<void>;
    handleControlReleased: () => void;
    markControlPending: () => void;
    clearControlRequestPending: () => void;
    releaseControlIfHeld: () => void;
    cleanupPeers: () => void;
} {
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [hasControl, setHasControl] = useState(false);
    const [isControlRequestPending, setIsControlRequestPending] =
        useState(false);

    const viewPeerConnectionRef = useRef<WebRTCPeer | null>(null);
    const controlPeerConnectionRef = useRef<WebRTCPeer | null>(null);
    const hasControlRef = useRef(false);
    const controlRequestPendingRef = useRef(false);

    const setPendingState = useCallback((value: boolean) => {
        controlRequestPendingRef.current = value;
        setIsControlRequestPending(value);
    }, []);

    const clearControlState = useCallback(() => {
        hasControlRef.current = false;
        setHasControl(false);
        setPendingState(false);
    }, [setPendingState]);

    const createViewConnection = useCallback(() => {
        if (viewPeerConnectionRef.current) {
            viewPeerConnectionRef.current.close();
        }

        const pc = new WebRTCPeer("view-peer", sendMessage, setRemoteStream);
        pc.createPeerConnection();
        viewPeerConnectionRef.current = pc;

        return pc;
    }, [sendMessage]);

    const createControlConnection = useCallback(() => {
        if (controlPeerConnectionRef.current) {
            controlPeerConnectionRef.current.close();
        }

        const pc = new WebRTCPeer(
            "control-peer",
            sendMessage,
            undefined,
            (state) => {
                if (
                    (state === "failed" || state === "disconnected") &&
                    hasControlRef.current
                ) {
                    console.log(
                        `Control peer entered ${state}; releasing control`,
                    );
                    hasControlRef.current = false;
                    sendMessage("control_release", {});
                }
            },
        );
        pc.createPeerConnection();

        controlPeerConnectionRef.current = pc;

        return pc;
    }, [sendMessage]);

    const sendOffer = useCallback(async () => {
        const pc = createViewConnection();

        try {
            const offer = await pc.createOffer();
            console.log("Sending offer");
            sendMessage("offer", {
                space: getCurrentSpace(),
                offer,
            });
        } catch (err) {
            console.error("Error creating offer:", err);
            showError("Failed to create connection offer");
        }
    }, [createViewConnection, getCurrentSpace, sendMessage, showError]);

    const sendControlOffer = useCallback(async () => {
        const pc = createControlConnection();

        try {
            pc.localStream = await getLocalStream();
            pc.addLocalTracks();
            const offer = await pc.createOffer();

            console.log("Sending control offer");
            sendMessage("control_offer", {
                space: getCurrentSpace(),
                offer,
            });
        } catch (err) {
            console.error("Error creating control offer:", err);
            showError("Failed to create control connection offer");
        }
    }, [
        createControlConnection,
        getCurrentSpace,
        getLocalStream,
        sendMessage,
        showError,
    ]);

    const handleAnswer = useCallback(
        async (data: AnswerData) => {
            console.log("Received answer from public server:", data);

            try {
                const pc = viewPeerConnectionRef.current;
                if (pc) {
                    await pc.handleAnswer(data);
                }
            } catch (err) {
                console.error("Error handling answer:", err);
                showError("Failed to handle connection answer");
            }
        },
        [showError],
    );

    const handleControlAnswer = useCallback(
        async (data: AnswerData) => {
            console.log("Received control answer from public server:", data);

            try {
                const pc = controlPeerConnectionRef.current;
                if (pc) {
                    await pc.handleAnswer(data);
                }
            } catch (err) {
                console.error("Error handling control answer:", err);
                showError("Failed to handle connection answer");
            }
        },
        [showError],
    );

    const handleIceCandidate = useCallback(async (data: IceCandidateData) => {
        try {
            await viewPeerConnectionRef.current?.handleIceCandidate(data);
        } catch (err) {
            console.error("Error adding ICE candidate:", err);
        }
    }, []);

    const requestControl = useCallback(() => {
        if (hasControlRef.current || controlRequestPendingRef.current) {
            return;
        }

        setPendingState(true);
        console.log("Requesting control");
        sendMessage("control_request", {});
    }, [sendMessage, setPendingState]);

    const handleRobotJoined = useCallback(
        async (_data: UserJoinedData) => {
            console.log("Robot joined, starting WebRTC connection");
            await sendOffer();
        },
        [sendOffer],
    );

    const handleRobotLeft = useCallback(
        (_data: UserLeftData) => {
            console.log("Robot left the space");
            showError("The robot has left the space. Please standby...");

            viewPeerConnectionRef.current?.close();
            viewPeerConnectionRef.current = null;

            clearControlState();
            controlPeerConnectionRef.current?.close();
            controlPeerConnectionRef.current = null;
        },
        [clearControlState, showError],
    );

    const handleControlGranted = useCallback(async () => {
        hasControlRef.current = true;
        setHasControl(true);
        setPendingState(false);
        await sendControlOffer();
    }, [sendControlOffer, setPendingState]);

    const handleControlReleased = useCallback(() => {
        clearControlState();
        controlPeerConnectionRef.current?.close();
        controlPeerConnectionRef.current = null;
    }, [clearControlState]);

    const markControlPending = useCallback(() => {
        setPendingState(true);
    }, [setPendingState]);

    const clearControlRequestPending = useCallback(() => {
        setPendingState(false);
    }, [setPendingState]);

    const releaseControlIfHeld = useCallback(() => {
        if (!hasControlRef.current) {
            return;
        }

        hasControlRef.current = false;
        sendMessage("control_release", {});
        clearControlState();
    }, [clearControlState, sendMessage]);

    const cleanupPeers = useCallback(() => {
        viewPeerConnectionRef.current?.close();
        viewPeerConnectionRef.current = null;

        controlPeerConnectionRef.current?.close();
        controlPeerConnectionRef.current = null;

        clearControlState();
    }, [clearControlState]);

    return {
        viewPeer: viewPeerConnectionRef.current,
        controlPeer: controlPeerConnectionRef.current,
        remoteStream,
        hasControl,
        isControlRequestPending,
        requestControl,
        sendOffer,
        handleAnswer,
        handleControlAnswer,
        handleIceCandidate,
        handleRobotJoined,
        handleRobotLeft,
        handleControlGranted,
        handleControlReleased,
        markControlPending,
        clearControlRequestPending,
        releaseControlIfHeld,
        cleanupPeers,
    };
}
