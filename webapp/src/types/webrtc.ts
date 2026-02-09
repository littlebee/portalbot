/**
 * WebRTC Type Definitions
 * Types for WebRTC signaling messages and application state
 */

export type ConnectionStatus = "connected" | "disconnected" | "connecting";

export interface WebRTCMessage {
  type: string;
  data: any;
}

export interface ConnectedData {
  sid: string;
}

export interface JoinSpaceData {
  space: string;
  is_initiator: boolean;
  participants: Array<string>;
}

export interface UserJoinedData {
  sid: string;
  participants: Array<string>;
}

export interface UserLeftData {
  sid: string;
}

export interface OfferData {
  offer: RTCSessionDescriptionInit;
  sid: string;
}

export interface AnswerData {
  answer: string;
  sid: string;
}

export interface IceCandidateData {
  candidate: RTCIceCandidateInit;
  sid: string;
}

export interface ErrorData {
  message: string;
}

export interface WebRTCState {
  // Connection
  connectionStatus: ConnectionStatus;
  statusText: string;
  clientId: string | null;
  currentSpace: string | null;

  // Media streams
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;

  // WebRTC states
  connectionState: RTCPeerConnectionState;
  iceState: RTCIceConnectionState;
  signalingState: RTCSignalingState;

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
