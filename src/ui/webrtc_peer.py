#!/usr/bin/env python3
"""
This service provides

- The onboard UI for the robot.  It displays everything seen on 1080x1080
LCD display on the robot. When a person requests and is granted control, a live
audio/video feed of the person granted control of the robot is shown. When no one
has control, the UI displays an animation of the robot's eyes.

It uses pygame for rendering the UI and handling touch input.
- When a person requests and is granted control, a live audio/video feed of the
person granted control of the robot is shown.
- When no one has control, the UI displays an animation of the robot's eyes.

"""

import asyncio
import logging
from typing import Optional

from aiortc import RTCIceCandidate, RTCPeerConnection, RTCSessionDescription
import numpy as np

from src.commons.audio_stream_player import AudioStreamPlayer


# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class WebRTCPeer:
    """
    Everything related to handling the WebRTC peer connection and tracks
    from the remote human operator is handled in this class.
    """

    def __init__(self):
        self.peer_connection: Optional[RTCPeerConnection] = None
        self.remote_video_frame: Optional[np.ndarray] = None
        self.audio_player = AudioStreamPlayer()
        self.stopping = False

    def full_stop(self):
        """Completely stop the peer connection and clean up resources"""
        self.stopping = True
        self.close_peer_connection()

    async def close_peer_connection(self):
        """Close the current peer connection but keep the option to create a new one later"""
        if self.peer_connection:
            logger.info("Closing existing peer connection before accepting new offer")
            await self.peer_connection.close()
            self.peer_connection = None
            self.remote_video_frame = None

    async def handle_offer(self, data: dict):
        """
        Accept a WebRTC offer relayed from the portalbot_service.
        The tracks from the offer are rendered (audio and video)
        on the onboard UI display.

        If we currently have a webrtc peer connection, it is replaced
        with the new offer.

        Args:
            data: Dictionary containing the WebRTC offer from remote human
        """
        sdp = data.get("sdp")
        offer_type = data.get("type")
        if not sdp or not offer_type:
            logger.error("Received WebRTC offer without SDP or type")
            return
        logger.info(f"Received WebRTC offer from public server: {sdp=} {offer_type=}")

        await self.close_peer_connection()

        # Create new peer connection
        self.peer_connection = RTCPeerConnection()

        # Set up event handlers
        @self.peer_connection.on("track")
        def on_track(track):
            logger.info(f"Received WebRTC track: {track.kind}")
            if track.kind == "video":
                asyncio.create_task(self.process_video_track(track))
            elif track.kind == "audio":
                asyncio.create_task(self.process_audio_track(track))

        @self.peer_connection.on("connectionstatechange")
        async def on_connectionstatechange():
            state = (
                self.peer_connection.connectionState
                if self.peer_connection != None
                else "null"
            )

            logger.info(f"WebRTC connection state: {state}")
            if state == "failed":
                logger.warning("WebRTC connection failed, closing peer connection")

        # Set remote description from offer
        offer = RTCSessionDescription(sdp=sdp, type=offer_type)
        await self.peer_connection.setRemoteDescription(offer)

        # Create answer
        answer = await self.peer_connection.createAnswer()
        await self.peer_connection.setLocalDescription(answer)
        return answer

    async def handle_ice_candidate(self, data: dict):
        """
        Handle ICE candidate from remote peer.
        Args:
            data: Dictionary containing the ICE candidate
        """
        candidate = data.get("candidate")
        if not candidate:
            logger.warning("Received ICE candidate without candidate data")
            return

        logger.debug(f"Received ICE candidate: {candidate}")
        if not self.peer_connection:
            logger.warning("Received ICE candidate but no peer connection exists")
            return

        rtc_candidate = self.create_RTCIceCandidate(candidate)
        await self.peer_connection.addIceCandidate(rtc_candidate)

    async def process_video_track(self, track):
        """Process incoming video frames from WebRTC track."""
        try:
            while not self.stopping:
                self.remote_video_frame = await track.recv()
        except Exception as e:
            logger.error(f"Error processing video track: {e}")

    async def process_audio_track(self, track):
        """Process incoming audio frames from WebRTC track."""
        try:
            logger.info("Starting audio track processing")

            # Start audio stream on first audio frame
            first_frame = await track.recv()
            await self.audio_player.setup_audio_stream(first_frame)

            # Queue the first frame
            self.audio_player.queue_audio_frame(first_frame)

            # Process remaining frames
            while not self.stopping:
                frame = await track.recv()
                self.audio_player.queue_audio_frame(frame)

        except Exception as e:
            logger.error(f"Error processing audio track: {e}")
        finally:
            self.audio_player.cleanup_audio_stream()

    def create_RTCIceCandidate(self, candidate: dict) -> RTCIceCandidate:
        parts = candidate["candidate"].split(" ")
        foundation = parts[0].split(":")[1]
        component = int(parts[1])
        protocol = parts[2]
        priority = int(parts[3])
        ip = parts[4]
        port = int(parts[5])
        type = parts[7]

        return RTCIceCandidate(
            component=component,
            foundation=foundation,
            ip=ip,
            port=port,
            priority=priority,
            protocol=protocol,
            type=type,
            sdpMid=candidate["sdpMid"],
            sdpMLineIndex=candidate["sdpMLineIndex"],
        )
