/**
 * useWebRTC Hook
 * React hook that manages WebRTC peer connection and signaling
 * Converted from the vanilla JS WebRTCClient class
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type {
    ConnectionStatus,
    ErrorData,
    JoinSpaceData,
    WebRTCMessage,
} from "@/types/webrtc";

import type { IServoConfig, IServoConfigByName } from "@/types/servo";

import type { WebRTCPeer } from "@/services/webrtcPeer";
import { useLocalMedia } from "@/hooks/webrtc/useLocalMedia";
import { usePeerSessions } from "@/hooks/webrtc/usePeerSessions";
import { useSignalingSocket } from "@/hooks/webrtc/useSignalingSocket";

export interface WebRTCState {
    viewPeer: WebRTCPeer | null;
    controlPeer: WebRTCPeer | null;

    // Connection
    connectionStatus: ConnectionStatus;
    statusText: string;
    clientId: string | null;
    currentSpace: string | null;
    servoConfigByName: IServoConfigByName | null;
    ws: WebSocket | null;

    // Media streams
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;

    // Media controls
    isAudioEnabled: boolean;
    isVideoEnabled: boolean;
    hasControl: boolean;
    isControlRequestPending: boolean;

    // Error
    error: string | null;
}

export interface WebRTCActions {
    joinSpace: (spaceName: string) => void;
    leaveSpace: () => void;
    requestControl: () => void;
    toggleAudio: () => void;
    toggleVideo: () => void;
    clearError: () => void;
    sendAngles: (angles: { pan: number; tilt: number }) => void;
}

export interface UseWebRTCReturn extends WebRTCState, WebRTCActions {}

export function useWebRTC(): UseWebRTCReturn {
    const [currentSpace, setCurrentSpace] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [servoConfigByName, setServoConfigByName] =
        useState<IServoConfigByName | null>(null);

    const currentSpaceRef = useRef<string | null>(null);
    const joiningSpaceRef = useRef<string | null>(null);

    const showError = useCallback((message: string) => {
        setError(message);
        setTimeout(() => setError(null), 5000);
    }, []);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const {
        localStream,
        isAudioEnabled,
        isVideoEnabled,
        getLocalStream,
        stopLocalMedia,
        toggleAudio,
        toggleVideo,
    } = useLocalMedia({
        showError,
        onGetLocalStreamError: () => {
            joiningSpaceRef.current = null;
        },
    });

    const {
        ws,
        connectionStatus,
        statusText,
        clientId,
        sendMessage,
        setMessageHandler,
    } = useSignalingSocket({ showError });

    const {
        viewPeer,
        controlPeer,
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
    } = usePeerSessions({
        sendMessage,
        showError,
        getCurrentSpace: () => currentSpaceRef.current,
        getLocalStream,
    });

    const handleJoinedSpace = useCallback(
        async (data: JoinSpaceData) => {
            console.log("Joined space:", data);
            joiningSpaceRef.current = null;
            currentSpaceRef.current = data.space;
            setCurrentSpace(data.space);
            await sendOffer();
        },
        [sendOffer],
    );

    const handleServoConfigUpdate = useCallback(
        (data: Array<IServoConfig>) => {
            const configByName: IServoConfigByName = {};
            data.forEach((config) => {
                configByName[config.name] = config;
            });
            setServoConfigByName(configByName);
        },
        [setServoConfigByName],
    );

    const handleMessage = useCallback(
        (message: WebRTCMessage) => {
            const { type, data } = message;
            console.log("Received message:", type, data);

            switch (type) {
                case "connected":
                    break;

                case "joined_space":
                    void handleJoinedSpace(data as JoinSpaceData);
                    break;

                case "user_joined":
                    void handleRobotJoined(data);
                    break;

                case "user_left":
                    handleRobotLeft(data);
                    break;

                case "answer":
                    void handleAnswer(data);
                    break;

                case "control_answer":
                    void handleControlAnswer(data);
                    break;

                case "control_granted":
                    void handleControlGranted();
                    break;

                case "control_pending":
                    markControlPending();
                    break;

                case "control_released":
                    handleControlReleased();
                    break;

                case "ice_candidate":
                    void handleIceCandidate(data);
                    break;

                case "servo_config":
                    handleServoConfigUpdate(data.servos as Array<IServoConfig>);
                    break;

                case "error":
                    console.error("Server error:", (data as ErrorData).message);
                    clearControlRequestPending();
                    showError((data as ErrorData).message);
                    break;

                case "pong":
                    break;

                default:
                    console.warn("Unknown message type:", type);
            }
        },
        [
            clearControlRequestPending,
            handleAnswer,
            handleControlAnswer,
            handleControlGranted,
            handleControlReleased,
            handleIceCandidate,
            handleJoinedSpace,
            handleRobotJoined,
            handleRobotLeft,
            markControlPending,
            showError,
        ],
    );

    const joinSpace = useCallback(
        (spaceName: string) => {
            const trimmedSpaceName = spaceName.trim();

            if (!trimmedSpaceName) {
                showError("Please enter a space name");
                return;
            }

            if (
                currentSpaceRef.current === trimmedSpaceName ||
                joiningSpaceRef.current === trimmedSpaceName
            ) {
                return;
            }

            joiningSpaceRef.current = trimmedSpaceName;

            try {
                sendMessage("join_space", { space: trimmedSpaceName });
            } catch (err) {
                joiningSpaceRef.current = null;
                console.error("Error joining space:", err);
                showError(
                    `Failed to access camera/microphone: ${
                        err instanceof Error ? err.message : "Unknown error"
                    }`,
                );
            }
        },
        [sendMessage, showError],
    );

    const leaveSpace = useCallback(() => {
        releaseControlIfHeld();

        if (currentSpaceRef.current) {
            sendMessage("leave_space", { space: currentSpaceRef.current });
        }

        joiningSpaceRef.current = null;
        currentSpaceRef.current = null;

        cleanupPeers();
        stopLocalMedia();
        setCurrentSpace(null);
    }, [cleanupPeers, releaseControlIfHeld, sendMessage, stopLocalMedia]);

    const sendAngles = useCallback(
        (angles: { pan: number; tilt: number }) => {
            if (!currentSpaceRef.current) {
                console.warn("Cannot send angles: not currently in a space");
                return;
            }
            sendMessage("set_angles", { angles });
        },
        [sendMessage],
    );

    useEffect(() => {
        setMessageHandler(handleMessage);

        return () => {
            setMessageHandler(null);
        };
    }, [handleMessage, setMessageHandler]);

    useEffect(() => {
        currentSpaceRef.current = currentSpace;
    }, [currentSpace]);

    useEffect(() => {
        return () => {
            cleanupPeers();
            stopLocalMedia();
        };
    }, [cleanupPeers, stopLocalMedia]);

    return {
        // Peers and connections
        controlPeer,
        viewPeer,

        // State
        connectionStatus,
        statusText,
        clientId,
        currentSpace,
        servoConfigByName,
        localStream,
        remoteStream,
        isAudioEnabled,
        isVideoEnabled,
        hasControl,
        isControlRequestPending,
        error,
        ws,

        // Actions
        joinSpace,
        leaveSpace,
        requestControl,
        toggleAudio,
        toggleVideo,
        clearError,
        sendAngles,
    };
}
