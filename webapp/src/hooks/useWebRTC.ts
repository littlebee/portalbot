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
  UseWebRTCReturn,
  UserJoinedData,
  UserLeftData,
  WebRTCMessage,
} from "@/types/webrtc";
import {
  INITIAL_RECONNECT_DELAY,
  MAX_RECONNECT_ATTEMPTS,
  MEDIA_CONSTRAINTS,
  WEBRTC_CONFIG,
  WEBSOCKET_PING_INTERVAL,
  getWebSocketUrl,
} from "@/services/webrtc-config";

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

  // WebRTC states
  const [connectionState, setConnectionState] =
    useState<RTCPeerConnectionState>("new");
  const [iceState, setIceState] = useState<RTCIceConnectionState>("new");
  const [signalingState, setSignalingState] =
    useState<RTCSignalingState>("stable");

  // Media controls
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Refs for objects that shouldn't trigger re-renders
  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
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
  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(WEBRTC_CONFIG);
    peerConnectionRef.current = pc;

    // Add local stream tracks
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log("Received remote track");
      const stream = new MediaStream();
      event.streams[0].getTracks().forEach((track) => {
        stream.addTrack(track);
      });
      setRemoteStream(stream);
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("Sending ICE candidate");
        sendMessage("ice_candidate", {
          space: currentSpace,
          candidate: event.candidate,
        });
      }
    };

    // Monitor connection state
    pc.onconnectionstatechange = () => {
      console.log("Connection state:", pc.connectionState);
      setConnectionState(pc.connectionState);
    };

    pc.oniceconnectionstatechange = () => {
      console.log("ICE state:", pc.iceConnectionState);
      setIceState(pc.iceConnectionState);
    };

    pc.onsignalingstatechange = () => {
      console.log("Signaling state:", pc.signalingState);
      setSignalingState(pc.signalingState);
    };
  }, [localStream, currentSpace, sendMessage]);

  // Create offer
  const createOffer = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await pc.setLocalDescription(offer);

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

  // Handle offer
  const handleOffer = useCallback(
    async (data: OfferData) => {
      try {
        if (!peerConnectionRef.current) {
          await createPeerConnection();
        }

        const pc = peerConnectionRef.current!;
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

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
    [createPeerConnection, currentSpace, sendMessage, showError],
  );

  // Handle answer
  const handleAnswer = useCallback(
    async (data: AnswerData) => {
      try {
        const pc = peerConnectionRef.current;
        if (pc) {
          console.log(
            "Creating remote description from answer from ",
            data.answer,
          );
          const remoteDesc = new RTCSessionDescription({
            sdp: data.answer,
            type: "answer",
          });

          await pc.setRemoteDescription(remoteDesc);
          console.log("Remote description set");
        }
      } catch (err) {
        console.error("Error handling answer:", error);
        showError("Failed to handle connection answer");
      }
    },
    [showError],
  );

  // Handle ICE candidate
  const handleIceCandidate = useCallback(async (data: IceCandidateData) => {
    try {
      const pc = peerConnectionRef.current;
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        console.log("ICE candidate added");
      }
    } catch (err) {
      console.error("Error adding ICE candidate:", error);
    }
  }, []);

  // This browser joined
  const handleJoinedSpace = useCallback(
    async (data: JoinSpaceData) => {
      console.log("Joined space:", data);
      setCurrentSpace(data.space);
      await createPeerConnection();
      await createOffer();
    },
    [createPeerConnection, createOffer],
  );

  // Other device joined
  const handleUserJoined = useCallback(
    async (_data: UserJoinedData) => {
      console.log("Peer joined, starting WebRTC connection");
      await createPeerConnection();
      await createOffer();
    },
    [createPeerConnection, createOffer],
  );

  // Handle user left
  const handleUserLeft = useCallback(
    (_data: UserLeftData) => {
      console.log("Peer left the space");
      showError("The other participant left the space");

      const pc = peerConnectionRef.current;
      if (pc) {
        pc.close();
        peerConnectionRef.current = null;
      }

      setRemoteStream(null);
      setConnectionState("new");
      setIceState("new");
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
          handleUserJoined(data as UserJoinedData);
          break;

        case "user_left":
          handleUserLeft(data as UserLeftData);
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
      handleUserJoined,
      handleUserLeft,
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
      INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current - 1);

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
        console.error("Failed to parse message:", error);
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
          await navigator.mediaDevices.getUserMedia(MEDIA_CONSTRAINTS);
        setLocalStream(stream);

        // Join the space
        sendMessage("join_space", { space: spaceName });
      } catch (err) {
        console.error("Error joining space:", error);
        showError(
          `Failed to access camera/microphone: ${
            err instanceof Error ? err.message : "Unknown error"
          }`,
        );
      }
    },
    [sendMessage, showError],
  );

  // Leave space
  const leaveSpace = useCallback(() => {
    if (currentSpace) {
      sendMessage("leave_space", { space: currentSpace });
    }

    // Clean up peer connection
    const pc = peerConnectionRef.current;
    if (pc) {
      pc.close();
      peerConnectionRef.current = null;
    }

    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }

    // Reset state
    setRemoteStream(null);
    setCurrentSpace(null);
    setConnectionState("new");
    setIceState("new");
    setSignalingState("stable");
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

      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }

      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return {
    // State
    connectionStatus,
    statusText,
    clientId,
    currentSpace,
    localStream,
    remoteStream,
    connectionState,
    iceState,
    signalingState,
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
