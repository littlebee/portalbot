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
