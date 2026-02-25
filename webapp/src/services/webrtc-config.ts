/**
 * WebRTC Configuration
 * STUN and TURN server configuration for NAT traversal
 */

export const WEBRTC_CONFIG: RTCConfiguration = {
    iceServers: [
        // Google's public STUN server
        {
            urls: "stun:stun.l.google.com:19302",
        },
        // Custom TURN server for NAT traversal
        {
            urls: "turn:ec2-3-134-87-34.us-east-2.compute.amazonaws.com:3478",
            username: "user",
            credential: "pass",
        },
    ],
    iceCandidatePoolSize: 10,
};

// WebSocket settings
export const WEBSOCKET_PING_INTERVAL = 30000; // 30 seconds
export const MAX_RECONNECT_ATTEMPTS = 5;
export const INITIAL_RECONNECT_DELAY = 1000; // 1 second

// Media constraints
export const MEDIA_CONSTRAINTS: MediaStreamConstraints = {
    video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
    },
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
    },
};

// Get WebSocket URL based on current protocol
export function getWebSocketUrl(): string {
    let protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    let host = window.location.host;

    if (window.location.hostname === "localhost") {
        // Use ws for localhost regardless of protocol
        protocol = "wss:";
        host = "portalbot.net";
    }

    return `${protocol}//${host}/ws`;
}
