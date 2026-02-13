import type { AnswerData, IceCandidateData, OfferData } from "@/types/webrtc";

import { WEBRTC_CONFIG } from "@/services/webrtc-config";

export class WebRTCPeer {
    private _peerConnection: RTCPeerConnection | null = null;
    private _connectionState: RTCPeerConnectionState = "new";
    private _iceState: RTCIceConnectionState = "new";
    private _signalingState: RTCSignalingState = "stable";

    private _localStream: MediaStream | null = null;
    private _remoteStream: MediaStream | null = null;

    private _onSendMessage: (type: string, payload: any) => void;

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

    get remoteStream() {
        return this._remoteStream;
    }

    private id: string;

    // ID is only used for logging and observability purposes, it is not used
    // for any logic. It can be the same as the peer ID used in the signaling
    // server, but it doesn't have to be.
    constructor(
        id: string,
        onSendMessage: (type: string, payload: any) => void,
    ) {
        this.id = id;
        this._onSendMessage = onSendMessage;
    }

    // Create peer connection
    public createPeerConnection() {
        const pc = new RTCPeerConnection(WEBRTC_CONFIG);
        this._peerConnection = pc;

        // Add local stream tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach((track) => {
                pc.addTrack(track, this.localStream!);
            });
        }

        // Handle remote stream
        pc.ontrack = (event) => {
            this.debug("Received remote track");
            const stream = new MediaStream();
            event.streams[0].getTracks().forEach((track) => {
                stream.addTrack(track);
            });
            this._remoteStream = stream;
        };

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                pc.addIceCandidate(event.candidate).catch((err) => {
                    this.debug(
                        "Error adding ICE candidate recv from peer connection:",
                        err,
                    );
                });

                // TODO: is this really neccessary? We are already sending the candidate in the signaling flow, do we need to also add it to the peer connection?
                console.log(this.id, ":Sending ICE candidate");
                this._onSendMessage("ice_candidate", {
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
        const pc = this._peerConnection;
        if (!pc) return;

        const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
        });

        await pc.setLocalDescription(offer);

        return offer;
    }

    // Handle offer
    public async handleOffer(data: OfferData) {
        if (!this._peerConnection) {
            await this.createPeerConnection();
        }

        const pc = this._peerConnection!;
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        this.debug(`Sending answer`);
        return answer;
    }
    // Handle answer
    public async handleAnswer(data: AnswerData) {
        const pc = this._peerConnection;
        if (pc) {
            this.debug(`Creating remote description from answer:`, data.answer);

            const remoteDesc = new RTCSessionDescription({
                sdp: data.answer,
                type: "answer",
            });

            await pc.setRemoteDescription(remoteDesc);
            this.debug(`Remote description set`);
        }
    }

    // Handle ICE candidate
    public async handleIceCandidate(data: IceCandidateData) {
        const pc = this._peerConnection;
        if (pc) {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            this.debug(`ICE candidate added`);
        }
    }

    public close() {
        if (this._peerConnection) {
            this._peerConnection.close();
            this._peerConnection = null;
            this._remoteStream = null;
            this._connectionState = "closed";
            this._iceState = "closed";
            this._signalingState = "closed";
            this.debug(`Peer connection closed`);
        }
    }

    private debug(message: string, ...args: Array<any>) {
        console.debug(`webRTCPeer [${this.id}]: ${message}`, ...args);
    }
}
