#!/usr/bin/env python3
"""
This service provides

- The onboard UI for the robot.  It displays everything seen on 1080x1080.
- A secure, authenticated WebSocket connection to the public_server.
- A WebRTC audio/video relay from basic_bot.services.vision to the public_server.
- A means for public_server to send remote control commands to the robot; relayed
  to basic_bot.services.central_hub

It uses pygame for rendering the UI and handling touch input.
- When a person requests and is granted control, a live audio/video feed of the
person granted control of the robot is shown.
- When no one has control, the UI displays an animation of the robot's eyes.

The service connects to the public_server via a secure WebSocket connection.
The robot identifies itself to public_server via the `join_space` websocket
message using a secret key stored in ./robot_secret.txt.

The service uses aiortc to create a WebRTC connection to public_server for
audio/video streaming. The service relays video from basic_bot.services.vision
and audio from the robot's microphone to public_server.

Over the websocket connection, the service receives remote control commands
from public_server and relays them to basic_bot.services.central_hub via
a local websocket connection.
"""

import asyncio
import logging
import sys
import threading
from pathlib import Path
from typing import Optional

import aiohttp
import cv2
import numpy as np
import pygame
from websockets.client import WebSocketClientProtocol

# Add project root to Python path
project_root = Path(__file__).parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from src.commons.robot_config import load_robot_config, RobotConfig  # noqa: E402
from src.commons.control_state_manager import (  # noqa: E402
    ControlStateManager,
)
from src.commons.portalbot_websocket_client import (  # noqa: E402
    PortalbotWebSocketClient,
)
from src.ui.robot_display import RobotDisplay  # noqa: E402
from basic_bot.commons.hub_state import HubState  # noqa: E402
from basic_bot.commons.hub_state_monitor import HubStateMonitor  # noqa: E402
from basic_bot.commons import messages  # noqa: E402

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class PortalbotService:
    """Main service for the portalbot robot"""

    def __init__(self):
        # Load robot configuration
        try:
            self.config: RobotConfig = load_robot_config()
            logger.info(
                f"Loaded robot config: {self.config.robot_id} "
                f"({self.config.robot_name}) -> {self.config.space_id}"
            )
        except Exception as e:
            logger.error(f"Failed to load robot configuration: {e}")
            raise

        # Get secret key
        try:
            self.secret_key = self.config.get_secret_key()
            logger.info("Secret key loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load secret key: {e}")
            raise

        # State management
        self.running = False

        # Initialize control state manager
        self.control_manager = ControlStateManager(
            on_send_message=self.send_to_public_server,
            on_relay_command=self.relay_command_to_hub,
        )

        # Initialize display
        face_cascade = self._load_face_detector()
        self.display = RobotDisplay(
            display_size=self.config.display_size, face_cascade=face_cascade
        )

        # Initialize WebSocket client
        self.ws_client = PortalbotWebSocketClient(
            server_url=self.config.public_server_url,
            robot_id=self.config.robot_id,
            robot_name=self.config.robot_name,
            space_id=self.config.space_id,
            secret_key=self.secret_key,
            on_message=self.handle_websocket_message,
        )

        # Hub state for communicating with basic_bot services
        self.hub_state = HubState()
        self.hub_monitor: Optional[HubStateMonitor] = None

        # Video frame buffers
        self.remote_video_frame: Optional[np.ndarray] = None
        self.robot_video_frame: Optional[np.ndarray] = None

        # HTTP client for WebRTC relay to vision service
        self.http_session: Optional[aiohttp.ClientSession] = None

    def _load_face_detector(self):
        """Load OpenCV face detector"""
        try:
            # TODO: I think this requires opencv-contrib-python to be installed as
            # opposed to just opencv-python, verify and document installation steps.
            # Try to load Haar Cascade for face detection
            cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"  # type: ignore
            face_cascade = cv2.CascadeClassifier(cascade_path)
            if face_cascade.empty():
                logger.warning("Failed to load face cascade classifier")
                return None
            else:
                logger.info("Face detector loaded successfully")
                return face_cascade
        except Exception as e:
            logger.warning(f"Could not load face detector: {e}")
            return None

    async def send_to_public_server(self, message_type: str, data: dict):
        """Send a message to the public server"""
        await self.ws_client.send_message(message_type, data)

    async def relay_command_to_hub(self, data: dict):
        """Relay command data to central_hub"""
        if self.hub_monitor and self.hub_monitor.connected_socket:
            await messages.send_update_state(
                self.hub_monitor.connected_socket,
                data,  # Already formatted as {"servo_angles": {"pan": 90, "tilt": 45}}
            )

    async def handle_webrtc_offer(self, data: dict):
        """
        Relay WebRTC offer to local vision service and send answer back.

        Args:
            data: Dictionary containing the WebRTC offer from remote human
        """
        offer = data.get("offer")
        sender_id = data.get("sid")

        if not offer:
            logger.error("Received WebRTC offer without offer data")
            return

        if not self.http_session:
            logger.error("HTTP session not initialized, cannot relay WebRTC offer")
            return

        logger.info(f"Relaying WebRTC offer from {sender_id} to vision service")

        try:
            # POST offer to vision service
            vision_url = f"{self.config.vision_service_url}/offer"
            async with self.http_session.post(
                vision_url, json={"offer": offer}
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    answer = result.get("answer")

                    if answer:
                        logger.info(
                            "Received answer from vision service, sending to public server"
                        )
                        # Send answer back to public server
                        await self.send_to_public_server(
                            "answer", {"answer": answer, "to": sender_id}
                        )
                    else:
                        logger.error("Vision service response missing answer field")
                else:
                    logger.error(
                        f"Vision service returned error: {response.status} - "
                        f"{await response.text()}"
                    )
        except aiohttp.ClientError as e:
            logger.error(f"Failed to connect to vision service: {e}")
        except Exception as e:
            logger.error(f"Error relaying WebRTC offer: {e}")

    async def handle_webrtc_ice_candidate(self, data: dict):
        """
        Handle ICE candidate from remote peer.

        Note: Currently the basic_bot vision service may not support
        ICE candidate relay via REST API. This is a placeholder for
        future implementation.

        Args:
            data: Dictionary containing the ICE candidate
        """
        candidate = data.get("candidate")
        sender_id = data.get("sid")

        if not candidate:
            logger.warning("Received ICE candidate without candidate data")
            return

        logger.debug(f"Received ICE candidate from {sender_id}: {candidate}")
        # TODO: If vision service supports ICE candidate relay, implement here
        # For now, we just log it as the vision service may handle ICE internally

    async def handle_websocket_message(self, message_type: str, data: dict):
        """Handle messages from the public server"""

        if message_type == "joined_space":
            logger.info(f"Successfully joined space: {data.get('space')}")

        elif message_type == "control_request":
            # Someone wants to control the robot
            await self.control_manager.handle_control_request(data)

        elif message_type == "control_released":
            # Controller released control
            await self.control_manager.handle_control_released(data)

        elif message_type == "set_angles":
            # Set servo angles command to relay to central_hub
            await self.control_manager.handle_set_angles(data)

        elif message_type == "offer":
            # WebRTC offer from remote operator - relay to vision service
            await self.handle_webrtc_offer(data)

        elif message_type == "ice_candidate":
            # WebRTC ICE candidate from remote operator
            await self.handle_webrtc_ice_candidate(data)

        elif message_type == "error":
            logger.error(f"Error from public server: {data.get('message')}")

    def on_hub_connect(self, websocket: WebSocketClientProtocol):
        """Called when connected to central hub"""
        logger.info("Connected to central_hub")

    def on_hub_state_update(
        self, websocket: WebSocketClientProtocol, msg_type: str, msg_data: dict
    ):
        """Called when hub state is updated"""
        # Check for vision frames
        if "vision_frame" in msg_data:
            # Store the latest frame from the robot's camera
            # In a real implementation, this would be sent via WebRTC
            self.robot_video_frame = msg_data["vision_frame"]

    def ui_loop(self):
        """Run the pygame UI loop in the main thread"""
        clock = pygame.time.Clock()

        while self.running:
            # Handle pygame events
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    self.running = False
                elif event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_ESCAPE:
                        self.running = False

            # Update display based on control state
            if (
                self.control_manager.is_controlled()
                and self.remote_video_frame is not None
            ):
                self.display.draw_remote_video(self.remote_video_frame)
            else:
                self.display.draw_robot_eyes()

            # Limit framerate
            clock.tick(30)  # 30 FPS

    async def async_main(self):
        """Main async loop"""
        # Create HTTP session for vision service communication
        self.http_session = aiohttp.ClientSession()

        try:
            # Start hub monitor
            self.hub_monitor = HubStateMonitor(
                self.hub_state,
                "portalbot",
                "*",  # Subscribe to all state updates
                on_connect=self.on_hub_connect,
                on_state_update=self.on_hub_state_update,
            )
            self.hub_monitor.start()

            # Connect to public server
            await self.ws_client.connect()

            # Keep the async loop running
            while self.running:
                await asyncio.sleep(0.1)

        finally:
            # Clean up HTTP session
            if self.http_session:
                await self.http_session.close()

    def run(self):
        """Main entry point"""
        self.running = True

        # Initialize pygame in main thread
        self.display.init_pygame(f"Portalbot - {self.config.robot_name}")

        # Start async loop in a separate thread
        async_thread = threading.Thread(target=lambda: asyncio.run(self.async_main()))
        async_thread.daemon = True
        async_thread.start()

        try:
            # Run UI loop in main thread (pygame requirement)
            self.ui_loop()
        except KeyboardInterrupt:
            logger.info("Shutting down...")
        finally:
            self.running = False
            if self.hub_monitor:
                self.hub_monitor.stop()
            self.ws_client.stop()
            self.display.cleanup()
            logger.info("Shutdown complete")


def main():
    """Entry point"""
    service = PortalbotService()
    service.run()


if __name__ == "__main__":
    main()
