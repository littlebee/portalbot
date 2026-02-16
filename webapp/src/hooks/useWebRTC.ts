/**
 * useWebRTC Hook
 * React hook that manages WebRTC peer connection and signaling
 * Converted from the vanilla JS WebRTCClient class
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type {
    AnswerData,
    ConnectedData,
    ConnectionStatus,
    ErrorData,
    IceCandidateData,
    JoinSpaceData,
    OfferData,
    UserJoinedData,
    UserLeftData,
    WebRTCMessage,
} from "@/types/webrtc";
import {
    INITIAL_RECONNECT_DELAY,
    MAX_RECONNECT_ATTEMPTS,
    MEDIA_CONSTRAINTS,
    WEBSOCKET_PING_INTERVAL,
    getWebSocketUrl,
} from "@/services/webrtc-config";

import { WebRTCPeer } from "@/services/webrtcPeer";

export interface WebRTCState {
    viewPeer: WebRTCPeer | null;
    controlPeer: WebRTCPeer | null;

    // Connection
    connectionStatus: ConnectionStatus;
    statusText: string;
    clientId: string | null;
    currentSpace: string | null;

    // Media streams
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;

    // Media controls
    isAudioEnabled: boolean;
    isVideoEnabled: boolean;

    // Error
    error: string | null;
}

export interface WebRTCActions {
    joinSpace: (spaceName: string) => Promise<void>;
    leaveSpace: () => void;
    toggleAudio: () => void;
    toggleVideo: () => void;
    clearError: () => void;
}

export interface UseWebRTCReturn extends WebRTCState, WebRTCActions {}

export function useWebRTC(): UseWebRTCReturn {
    // Connection state
    const [connectionStatus, setConnectionStatus] =
        useState<ConnectionStatus>("disconnected");
    const [statusText, setStatusText] = useState("Disconnected");
    const [clientId, setClientId] = useState<string | null>(null);
    const [currentSpace, setCurrentSpace] = useState<string | null>(null);

    // Media streams
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

    // Media controls
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);

    // Error state
    const [error, setError] = useState<string | null>(null);

    // Refs for objects that shouldn't trigger re-renders
    const wsRef = useRef<WebSocket | null>(null);
    const viewPeerConnectionRef = useRef<WebRTCPeer | null>(null);
    const controlPeerConnectionRef = useRef<WebRTCPeer | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const reconnectTimerRef = useRef<number | null>(null);
    const pingIntervalRef = useRef<number | null>(null);
    const intentionalDisconnectRef = useRef(false);

    // Update connection status
    const updateConnectionStatus = useCallback(
        (status: ConnectionStatus, text: string) => {
            setConnectionStatus(status);
            setStatusText(text);
        },
        [],
    );

    // Show error message
    const showError = useCallback((message: string) => {
        setError(message);
        setTimeout(() => setError(null), 5000);
    }, []);

    // Clear error
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    // Send message to signaling server
    const sendMessage = useCallback((type: string, data: any = {}) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type, data }));
        } else {
            console.error("WebSocket not connected, cannot send message");
        }
    }, []);

    // Start ping interval
    const startPingInterval = useCallback(() => {
        if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
        }
        pingIntervalRef.current = window.setInterval(() => {
            sendMessage("ping");
        }, WEBSOCKET_PING_INTERVAL);
    }, [sendMessage]);

    // Stop ping interval
    const stopPingInterval = useCallback(() => {
        if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
            pingIntervalRef.current = null;
        }
    }, []);

    // Create peer connection
    const createViewConnection = useCallback(() => {
        if (viewPeerConnectionRef.current) {
            viewPeerConnectionRef.current.close();
        }

        const pc = new WebRTCPeer("view-peer", sendMessage, setRemoteStream);
        pc.createPeerConnection();

        viewPeerConnectionRef.current = pc;

        return pc;
    }, []);

    // We have been granted control of the robot, so we create
    // a new peer connection from that offer that will be used
    // for sending our AV tracks to the robot. This is separate
    // from the view connection that we use to receive the robot's
    // AV tracks, and is only used for sending our AV tracks when
    // we have control of the robot.
    const createControlConnection = useCallback(() => {
        if (controlPeerConnectionRef.current) {
            controlPeerConnectionRef.current.close();
        }

        const pc = new WebRTCPeer("control-peer", sendMessage);
        pc.localStream = localStream;
        pc.createPeerConnection();

        controlPeerConnectionRef.current = pc;

        return pc;
    }, [sendMessage, localStream]);

    // When we join a space, we create the peer connection and
    // immediately create and send an offer.  The BB view service
    // will answer with its AV tracks.  This is different than
    // the offer offer we receive from the public server (next function)
    // whenever we have be give control of the robot. The answer to the
    // offer we receive from the public server is where we will
    // attach our AV tracks.
    const sendOffer = useCallback(async () => {
        const pc = createViewConnection();
        try {
            const offer = await pc.createOffer();

            console.log("Sending offer");
            sendMessage("offer", {
                space: currentSpace,
                offer: offer,
            });
        } catch (err) {
            console.error("Error creating offer:", error);
            showError("Failed to create connection offer");
        }
    }, [currentSpace, sendMessage, showError]);

    // When the robot grants us control, it will send an offer from the onboard ui,
    // through the public server, that is handled here.  We answer that offer'
    // with our av tracks (see also, createControlConnection).
    //
    const handleOffer = useCallback(
        async (data: OfferData) => {
            try {
                const pc = await createControlConnection();
                const answer = pc.handleOffer(data);

                console.log("Sending answer");
                sendMessage("answer", {
                    space: currentSpace,
                    answer: answer,
                });
            } catch (err) {
                console.error("Error handling offer:", error);
                showError("Failed to handle connection offer");
            }
        },
        [currentSpace, sendMessage, showError],
    );

    // Handle answer
    const handleAnswer = useCallback(
        async (data: AnswerData) => {
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

    // Handle ICE candidate
    const handleIceCandidate = useCallback(async (data: IceCandidateData) => {
        try {
            await viewPeerConnectionRef.current?.handleIceCandidate(data);
        } catch (err) {
            console.error("Error adding ICE candidate:", err);
        }
    }, []);

    // This browser joined
    const handleJoinedSpace = useCallback(
        async (data: JoinSpaceData) => {
            console.log("Joined space:", data);
            setCurrentSpace(data.space);
            await sendOffer();
        },
        [sendOffer],
    );

    // IF the robot goes offline or leaves the space, we get notified here
    // when it later rejoins the space
    const handleRobotJoined = useCallback(
        async (_data: UserJoinedData) => {
            console.log("Robot joined, starting WebRTC connection");
            await sendOffer();
        },
        [sendOffer],
    );

    // Handle user left
    const handleRobotLeft = useCallback(
        (_data: UserLeftData) => {
            console.log("Robot left the space");
            showError("The robot has left the space. Please standby...");

            viewPeerConnectionRef.current?.close();
            viewPeerConnectionRef.current = null;

            controlPeerConnectionRef.current?.close();
            controlPeerConnectionRef.current = null;
        },
        [showError],
    );

    // Handle WebSocket messages
    const handleMessage = useCallback(
        (message: WebRTCMessage) => {
            const { type, data } = message;

            console.log("Received message:", type, data);

            switch (type) {
                case "connected":
                    setClientId((data as ConnectedData).sid);
                    console.log("Client ID:", (data as ConnectedData).sid);
                    break;

                case "joined_space": {
                    handleJoinedSpace(data as JoinSpaceData);
                    break;
                }

                case "user_joined":
                    handleRobotJoined(data as UserJoinedData);
                    break;

                case "user_left":
                    handleRobotLeft(data as UserLeftData);
                    break;

                case "offer":
                    handleOffer(data as OfferData);
                    break;

                case "answer":
                    handleAnswer(data as AnswerData);
                    break;

                case "ice_candidate":
                    handleIceCandidate(data as IceCandidateData);
                    break;

                case "error":
                    console.error("Server error:", (data as ErrorData).message);
                    showError((data as ErrorData).message);
                    break;

                case "pong":
                    // Ping response received
                    break;

                default:
                    console.warn("Unknown message type:", type);
            }
        },
        [
            handleRobotJoined,
            handleRobotLeft,
            handleOffer,
            handleAnswer,
            handleIceCandidate,
            showError,
        ],
    );

    // Attempt reconnection
    const attemptReconnect = useCallback(() => {
        reconnectAttemptsRef.current++;
        const delay =
            INITIAL_RECONNECT_DELAY *
            Math.pow(2, reconnectAttemptsRef.current - 1);

        console.log(
            `Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`,
        );
        updateConnectionStatus(
            "disconnected",
            `Reconnecting in ${Math.round(delay / 1000)}s...`,
        );

        reconnectTimerRef.current = window.setTimeout(() => {
            connectToSignalingServer();
        }, delay);
    }, [updateConnectionStatus]);

    // Connect to signaling server
    const connectToSignalingServer = useCallback(() => {
        const wsUrl = getWebSocketUrl();
        console.log("Connecting to WebSocket:", wsUrl);

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log("WebSocket connected");
            updateConnectionStatus("connected", "Connected to server");
            reconnectAttemptsRef.current = 0;
            startPingInterval();
        };

        ws.onclose = (event) => {
            console.log("WebSocket closed:", event.code, event.reason);
            updateConnectionStatus("disconnected", "Disconnected");
            stopPingInterval();

            if (
                !intentionalDisconnectRef.current &&
                reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS
            ) {
                attemptReconnect();
            } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
                showError("Failed to reconnect after multiple attempts");
            }
        };

        ws.onerror = (err) => {
            console.error("WebSocket error:", err);
            showError("WebSocket connection error");
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                handleMessage(message);
            } catch (err) {
                console.error("Failed to parse message:", err);
            }
        };
    }, [
        updateConnectionStatus,
        startPingInterval,
        stopPingInterval,
        attemptReconnect,
        showError,
        handleMessage,
    ]);

    // Join space
    const joinSpace = useCallback(
        async (spaceName: string) => {
            if (!spaceName.trim()) {
                showError("Please enter a space name");
                return;
            }

            try {
                // Get local media
                const stream =
                    await navigator.mediaDevices.getUserMedia(
                        MEDIA_CONSTRAINTS,
                    );
                setLocalStream(stream);

                // Join the space
                sendMessage("join_space", { space: spaceName });
            } catch (err) {
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

    // We are leaving the space...
    const leaveSpace = useCallback(() => {
        if (currentSpace) {
            sendMessage("leave_space", { space: currentSpace });
        }

        viewPeerConnectionRef.current?.close();
        viewPeerConnectionRef.current = null;

        controlPeerConnectionRef.current?.close();
        controlPeerConnectionRef.current = null;

        // Stop local stream
        if (localStream) {
            localStream.getTracks().forEach((track) => track.stop());
            setLocalStream(null);
        }

        setCurrentSpace(null);
    }, [currentSpace, localStream, sendMessage]);

    // Toggle audio
    const toggleAudio = useCallback(() => {
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            audioTrack.enabled = !audioTrack.enabled;
            setIsAudioEnabled(audioTrack.enabled);
        }
    }, [localStream]);

    // Toggle video
    const toggleVideo = useCallback(() => {
        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            videoTrack.enabled = !videoTrack.enabled;
            setIsVideoEnabled(videoTrack.enabled);
        }
    }, [localStream]);

    // Connect on mount
    useEffect(() => {
        connectToSignalingServer();

        // Cleanup on unmount
        return () => {
            intentionalDisconnectRef.current = true;
            stopPingInterval();

            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
            }

            if (wsRef.current) {
                wsRef.current.close();
            }

            if (viewPeerConnectionRef.current) {
                viewPeerConnectionRef.current.close();
            }

            if (localStream) {
                localStream.getTracks().forEach((track) => track.stop());
            }
        };
    }, []);

    return {
        // Peers and connections
        controlPeer: controlPeerConnectionRef.current,
        viewPeer: viewPeerConnectionRef.current,

        // State
        connectionStatus,
        statusText,
        clientId,
        currentSpace,
        localStream,
        remoteStream,
        isAudioEnabled,
        isVideoEnabled,
        error,

        // Actions
        joinSpace,
        leaveSpace,
        toggleAudio,
        toggleVideo,
        clearError,
    };
}
