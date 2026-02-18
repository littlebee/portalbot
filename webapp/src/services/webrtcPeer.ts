import type { AnswerData, IceCandidateData, OfferData } from "@/types/webrtc";

import { WEBRTC_CONFIG } from "@/services/webrtc-config";

export class WebRTCPeer {
    private _peerConnection: RTCPeerConnection | null = null;
    private _connectionState: RTCPeerConnectionState = "new";
    private _iceState: RTCIceConnectionState = "new";
    private _signalingState: RTCSignalingState = "stable";

    private _localStream: MediaStream | null = null;

    private _onIceCandidateRecv: (type: string, payload: any) => void;
    private _onRemoteStream?: (stream: MediaStream) => void;

    get peerConnection() {
        return this._peerConnection;
    }

    get connectionState() {
        return this._connectionState;
    }

    get iceState() {
        return this._iceState;
    }

    get signalingState() {
        return this._signalingState;
    }

    get localStream() {
        return this._localStream;
    }

    set localStream(stream: MediaStream | null) {
        this._localStream = stream;
    }

    private id: string;

    // ID is only used for logging and observability purposes, it is not used
    // for any logic. It can be the same as the peer ID used in the signaling
    // server, but it doesn't have to be.
    constructor(
        id: string,
        onIceCandidateRecv: (type: string, payload: any) => void,
        onRemoteStream?: (stream: MediaStream) => void,
    ) {
        this.id = id;
        this._onIceCandidateRecv = onIceCandidateRecv;
        this._onRemoteStream = onRemoteStream;
    }

    // Create peer connection
    public createPeerConnection() {
        const pc = new RTCPeerConnection(WEBRTC_CONFIG);
        this._peerConnection = pc;
        this.debug("Peer connection created with config:", WEBRTC_CONFIG);

        // Handle remote stream
        pc.ontrack = (event) => {
            this.debug("Received remote track");
            if (!this._onRemoteStream) {
                this.debug(
                    "Recieved remote track but no onRemoteStream passed in constructor",
                );
                return;
            }

            const stream = new MediaStream();
            event.streams[0].getTracks().forEach((track) => {
                this.debug(`Adding remote track: ${track}`);
                stream.addTrack(track);
            });
            this._onRemoteStream(stream);
        };

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.debug("Sending ICE candidate");
                // TODO : understand why this is needed. Presumably the ice
                // candidate sent by the robot already has the correct SDP mid
                // and mline index, so we shouldn't need to send through
                // the signaling server again. However, if we don't do this,
                // then the ICE connection never completes and users cannot
                // see/hear the bot AV unless they are on the same local
                // network as the bot. This may be
                this._onIceCandidateRecv("ice_candidate", {
                    candidate: event.candidate,
                });
            }
        };

        // Monitor connection state
        pc.onconnectionstatechange = () => {
            this.debug(`Connection state: ${pc.connectionState}`);
            this._connectionState = pc.connectionState;
        };

        pc.oniceconnectionstatechange = () => {
            this.debug(`ICE state: ${pc.iceConnectionState}`);
            this._iceState = pc.iceConnectionState;
        };

        pc.onsignalingstatechange = () => {
            this.debug(`Signaling state: ${pc.signalingState}`);
            this._signalingState = pc.signalingState;
        };
    }

    // Create offer
    public async createOffer() {
        this.debug(`Creating offer`);
        const pc = this._peerConnection;
        if (!pc) {
            this.error("Cannot create offer: Peer connection not initialized");
            return;
        }

        const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
        });

        await pc.setLocalDescription(offer);

        return offer;
    }

    private addLocalTracks() {
        this.debug(`Adding local tracks to peer connection`);
        const pc = this._peerConnection;
        if (!pc) {
            this.error(
                "Cannot add local tracks: Peer connection not initialized",
            );
            return;
        }
        if (!this.localStream) {
            // This is allowed because useWebRTC creates two peer connections
            // one for the control channel which only has browser audio
            // and video tracks added to it, and a view peer connection
            // which has the local media stream tracks added to it.
            this.debug("No local stream available to add tracks from");
            return;
        }
        // Add local stream tracks
        this.localStream.getTracks().forEach((track) => {
            this.debug(`Adding local track: ${track.kind}`);
            pc.addTrack(track, this.localStream!);
        });
    }

    // Handle offer
    public async handleOffer(data: OfferData) {
        this.debug(`Received offer:`, data.offer);
        const pc = this._peerConnection;
        if (!pc) {
            this.error("Cannot handle offer: Peer connection not initialized");
            return;
        }
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        this.addLocalTracks();

        this.debug(`Sending answer`);
        return answer;
    }
    // Handle answer
    public async handleAnswer(data: AnswerData) {
        const pc = this._peerConnection;
        if (!pc) {
            this.error("Cannot handle answer: Peer connection not initialized");
            return;
        }
        this.debug(`Creating remote description from answer:`, data.answer);

        const remoteDesc = new RTCSessionDescription({
            sdp: data.answer,
            type: "answer",
        });

        await pc.setRemoteDescription(remoteDesc);
        this.debug(`Remote description set`);
    }

    // Handle ICE candidate
    public async handleIceCandidate(data: IceCandidateData) {
        this.debug(`Received ICE candidate:`, data.candidate);
        const pc = this._peerConnection;
        if (!pc) {
            this.error(
                "Cannot handle ICE candidate: Peer connection not initialized",
            );
            return;
        }

        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        this.debug(`ICE candidate added`);
    }

    public close() {
        if (this._peerConnection) {
            this._peerConnection.close();
        }
        this._peerConnection = null;
        this._connectionState = "closed";
        this._iceState = "closed";
        this._signalingState = "closed";
        this.debug(`Peer connection closed`);
    }

    private getLogPrefix() {
        return `webRTCPeer [${this.id}]`;
    }

    private debug(message: string, ...args: Array<any>) {
        // TODO: Don't log anything unless there is a location parameter
        // named "debug-webrtc" in the URL.
        console.log(`${this.getLogPrefix()}: ${message}`, ...args);
    }

    private error(message: string, ...args: Array<any>) {
        this.error(`${this.getLogPrefix()} ERROR: ${message}`, ...args);
    }
}
