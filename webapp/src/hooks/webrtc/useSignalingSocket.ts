import { useCallback, useEffect, useRef, useState } from "react";

import type {
    ConnectedData,
    ConnectionStatus,
    WebRTCMessage,
} from "@/types/webrtc";
import {
    INITIAL_RECONNECT_DELAY,
    MAX_RECONNECT_ATTEMPTS,
    WEBSOCKET_PING_INTERVAL,
    getWebSocketUrl,
} from "@/services/webrtc-config";

interface UseSignalingSocketOptions {
    showError: (message: string) => void;
}

export function useSignalingSocket({ showError }: UseSignalingSocketOptions): {
    ws: WebSocket | null;
    connectionStatus: ConnectionStatus;
    statusText: string;
    clientId: string | null;
    sendMessage: (type: string, data?: any) => void;
    setMessageHandler: (
        handler: ((message: WebRTCMessage) => void) | null,
    ) => void;
} {
    const [ws, setWs] = useState<WebSocket | null>(null);
    const [connectionStatus, setConnectionStatus] =
        useState<ConnectionStatus>("disconnected");
    const [statusText, setStatusText] = useState("Disconnected");
    const [clientId, setClientId] = useState<string | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const reconnectTimerRef = useRef<number | null>(null);
    const pingIntervalRef = useRef<number | null>(null);
    const intentionalDisconnectRef = useRef(false);
    const messageHandlerRef = useRef<((message: WebRTCMessage) => void) | null>(
        null,
    );

    const updateConnectionStatus = useCallback(
        (status: ConnectionStatus, text: string) => {
            setConnectionStatus(status);
            setStatusText(text);
        },
        [],
    );

    const sendMessage = useCallback((type: string, data: any = {}) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type, data }));
            return;
        }

        console.error("WebSocket not connected, cannot send message");
    }, []);

    const startPingInterval = useCallback(() => {
        if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
        }

        pingIntervalRef.current = window.setInterval(() => {
            sendMessage("ping");
        }, WEBSOCKET_PING_INTERVAL);
    }, [sendMessage]);

    const stopPingInterval = useCallback(() => {
        if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
            pingIntervalRef.current = null;
        }
    }, []);

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

    const connectToSignalingServer = useCallback(() => {
        const wsUrl = getWebSocketUrl();
        console.log("Connecting to WebSocket:", wsUrl);
        updateConnectionStatus("connecting", "Connecting to server...");

        const nextWs = new WebSocket(wsUrl);
        wsRef.current = nextWs;
        setWs(nextWs);

        nextWs.onopen = () => {
            console.log("WebSocket connected");
            updateConnectionStatus("connected", "Connected to server");
            reconnectAttemptsRef.current = 0;
            startPingInterval();
        };

        nextWs.onclose = (event) => {
            console.log("WebSocket closed:", event.code, event.reason);
            updateConnectionStatus("disconnected", "Disconnected");
            stopPingInterval();
            setWs(null);

            if (
                !intentionalDisconnectRef.current &&
                reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS
            ) {
                attemptReconnect();
                return;
            }

            if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
                showError("Failed to reconnect after multiple attempts");
            }
        };

        nextWs.onerror = (err) => {
            console.error("WebSocket error:", err);
            showError("WebSocket connection error");
        };

        nextWs.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data) as WebRTCMessage;

                if (message.type === "connected") {
                    const connectedData = message.data as ConnectedData;
                    setClientId(connectedData.sid);
                    console.log("Client ID:", connectedData.sid);
                }

                messageHandlerRef.current?.(message);
            } catch (err) {
                console.error("Failed to parse message:", err);
            }
        };
    }, [
        attemptReconnect,
        showError,
        startPingInterval,
        stopPingInterval,
        updateConnectionStatus,
    ]);

    const setMessageHandler = useCallback(
        (handler: ((message: WebRTCMessage) => void) | null) => {
            messageHandlerRef.current = handler;
        },
        [],
    );

    useEffect(() => {
        connectToSignalingServer();

        return () => {
            intentionalDisconnectRef.current = true;
            stopPingInterval();

            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }

            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }

            setWs(null);
        };
    }, [connectToSignalingServer, stopPingInterval]);

    return {
        ws,
        connectionStatus,
        statusText,
        clientId,
        sendMessage,
        setMessageHandler,
    };
}
