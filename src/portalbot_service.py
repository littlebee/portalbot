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
import json
import logging
import sys
import threading
import time
from enum import Enum
from pathlib import Path
from typing import Optional, Dict, Any

import cv2
import numpy as np
import pygame
import websockets
from websockets.client import WebSocketClientProtocol

# Add project root to Python path
project_root = Path(__file__).parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from src.commons.robot_config import load_robot_config, RobotConfig  # noqa: E402
from basic_bot.commons.hub_state import HubState  # noqa: E402
from basic_bot.commons.hub_state_monitor import HubStateMonitor  # noqa: E402
from basic_bot.commons import messages  # noqa: E402

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class ControlState(Enum):
    """States for robot control"""

    IDLE = "idle"  # No one controlling, showing robot eyes
    CONTROL_REQUESTED = "control_requested"  # Someone wants control
    VALIDATING = "validating"  # Checking audio and face detection
    CONTROLLED = "controlled"  # Someone is actively controlling


class PortalbotService:
    """Main service for the portalbot robot"""

    def __init__(self):
        # Load robot configuration
        try:
            self.config: RobotConfig = load_robot_config()
            logger.info(
                f"Loaded robot config: {self.config.robot_name} -> {self.config.space_id}"
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
        self.control_state = ControlState.IDLE
        self.controller_id: Optional[str] = None
        self.running = False

        # WebSocket connections
        self.public_ws: Optional[WebSocketClientProtocol] = None
        self.hub_ws: Optional[WebSocketClientProtocol] = None

        # Hub state for communicating with basic_bot services
        self.hub_state = HubState()
        self.hub_monitor: Optional[HubStateMonitor] = None

        # Pygame display
        self.screen: Optional[pygame.Surface] = None
        self.display_size = self.config.display_size

        # Video frame buffers
        self.remote_video_frame: Optional[np.ndarray] = None
        self.robot_video_frame: Optional[np.ndarray] = None

        # Face detection
        self.face_cascade = None
        self.load_face_detector()

        # Audio monitoring
        self.audio_level = 0.0
        self.audio_threshold = 0.01  # Minimum audio level to be considered "present"

    def load_face_detector(self):
        """Load OpenCV face detector"""
        try:
            # Try to load Haar Cascade for face detection
            cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            self.face_cascade = cv2.CascadeClassifier(cascade_path)
            if self.face_cascade.empty():
                logger.warning("Failed to load face cascade classifier")
                self.face_cascade = None
            else:
                logger.info("Face detector loaded successfully")
        except Exception as e:
            logger.warning(f"Could not load face detector: {e}")
            self.face_cascade = None

    def init_pygame(self):
        """Initialize pygame display"""
        try:
            pygame.init()
            # Create a square display
            self.screen = pygame.display.set_mode(
                (self.display_size, self.display_size)
            )
            pygame.display.set_caption(f"Portalbot - {self.config.robot_name}")
            logger.info(
                f"Pygame display initialized: {self.display_size}x{self.display_size}"
            )
        except Exception as e:
            logger.error(f"Failed to initialize pygame: {e}")
            raise

    def draw_robot_eyes(self):
        """Draw animated robot eyes when idle"""
        if not self.screen:
            return

        # Fill background
        self.screen.fill((20, 20, 40))

        # Simple animated eyes
        center_x = self.display_size // 2
        center_y = self.display_size // 2
        eye_distance = 150
        eye_radius = 60
        pupil_radius = 30

        # Animate pupil position with time
        t = time.time()
        pupil_offset_x = int(20 * np.sin(t * 0.5))
        pupil_offset_y = int(20 * np.cos(t * 0.7))

        # Left eye
        pygame.draw.circle(
            self.screen,
            (255, 255, 255),
            (center_x - eye_distance, center_y),
            eye_radius,
        )
        pygame.draw.circle(
            self.screen,
            (20, 20, 40),
            (center_x - eye_distance + pupil_offset_x, center_y + pupil_offset_y),
            pupil_radius,
        )

        # Right eye
        pygame.draw.circle(
            self.screen,
            (255, 255, 255),
            (center_x + eye_distance, center_y),
            eye_radius,
        )
        pygame.draw.circle(
            self.screen,
            (20, 20, 40),
            (center_x + eye_distance + pupil_offset_x, center_y + pupil_offset_y),
            pupil_radius,
        )

        pygame.display.flip()

    def draw_remote_video(self, frame: np.ndarray):
        """Draw remote operator's video on display"""
        if not self.screen or frame is None:
            return

        try:
            # Detect and extract the largest face
            face_frame = self.extract_largest_face(frame)

            if face_frame is not None:
                display_frame = face_frame
            else:
                # No face detected, show full frame
                display_frame = frame

            # Convert BGR to RGB
            display_frame = cv2.cvtColor(display_frame, cv2.COLOR_BGR2RGB)

            # Resize to fit display (square)
            display_frame = cv2.resize(
                display_frame, (self.display_size, self.display_size)
            )

            # Convert to pygame surface
            display_frame = np.rot90(display_frame)
            surface = pygame.surfarray.make_surface(display_frame)

            # Draw to screen
            self.screen.blit(surface, (0, 0))
            pygame.display.flip()

        except Exception as e:
            logger.error(f"Error drawing remote video: {e}")

    def extract_largest_face(self, frame: np.ndarray) -> Optional[np.ndarray]:
        """
        Extract the largest detected face from the frame.
        Returns None if no face is detected.
        """
        if self.face_cascade is None or frame is None:
            return None

        try:
            # Convert to grayscale for detection
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

            # Detect faces
            faces = self.face_cascade.detectMultiScale(
                gray, scaleFactor=1.1, minNeighbors=5, minSize=(100, 100)
            )

            if len(faces) == 0:
                return None

            # Find largest face
            largest_face = max(faces, key=lambda f: f[2] * f[3])
            x, y, w, h = largest_face

            # Extract face region with some padding
            padding = int(w * 0.3)
            x1 = max(0, x - padding)
            y1 = max(0, y - padding)
            x2 = min(frame.shape[1], x + w + padding)
            y2 = min(frame.shape[0], y + h + padding)

            face_frame = frame[y1:y2, x1:x2]
            return face_frame

        except Exception as e:
            logger.error(f"Error in face detection: {e}")
            return None

    def detect_face_present(self, frame: np.ndarray) -> bool:
        """Check if a face is present in the frame"""
        if self.face_cascade is None or frame is None:
            # If we can't detect, assume face is present (fail open)
            return True

        try:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = self.face_cascade.detectMultiScale(
                gray, scaleFactor=1.1, minNeighbors=5, minSize=(100, 100)
            )
            return len(faces) > 0
        except Exception as e:
            logger.error(f"Error detecting face: {e}")
            return True  # Fail open

    async def send_to_public_server(self, message_type: str, data: dict):
        """Send a message to the public server"""
        if not self.public_ws:
            logger.warning("Cannot send message - not connected to public server")
            return

        try:
            message = {"type": message_type, "data": data}
            await self.public_ws.send(json.dumps(message))
            logger.debug(f"Sent to public server: {message_type}")
        except Exception as e:
            logger.error(f"Error sending to public server: {e}")

    async def handle_public_server_message(self, message: dict):
        """Handle messages from the public server"""
        message_type = message.get("type")
        data = message.get("data", {})

        logger.info(f"Received from public server: {message_type}")

        if message_type == "connected":
            # Server acknowledged connection, now identify as robot and join space
            await self.identify_as_robot()

        elif message_type == "joined_space":
            logger.info(f"Successfully joined space: {data.get('space')}")

        elif message_type == "control_request":
            # Someone wants to control the robot
            await self.handle_control_request(data)

        elif message_type == "control_released":
            # Controller released control
            await self.handle_control_released(data)

        elif message_type == "remote_command":
            # Remote control command to relay to central_hub
            await self.handle_remote_command(data)

        elif message_type == "offer":
            # WebRTC offer from remote operator
            # TODO: Implement WebRTC handling
            logger.info("Received WebRTC offer (WebRTC not yet implemented)")

        elif message_type == "ice_candidate":
            # WebRTC ICE candidate
            # TODO: Implement WebRTC handling
            logger.debug("Received ICE candidate (WebRTC not yet implemented)")

        elif message_type == "error":
            logger.error(f"Error from public server: {data.get('message')}")

    async def identify_as_robot(self):
        """Send robot identification to public server"""
        await self.send_to_public_server(
            "robot_identify",
            {
                "robot_name": self.config.robot_name,
                "space": self.config.space_id,
                "secret_key": self.secret_key,
            },
        )

    async def handle_control_request(self, data: dict):
        """Handle a control request from a remote operator"""
        controller_id = data.get("controller_id")
        logger.info(f"Control requested by: {controller_id}")

        self.control_state = ControlState.CONTROL_REQUESTED
        self.controller_id = controller_id

        # TODO: Start validation process (audio + face detection)
        # For now, automatically grant control
        await asyncio.sleep(0.5)  # Simulate validation

        # Grant control
        self.control_state = ControlState.CONTROLLED
        await self.send_to_public_server(
            "control_granted", {"controller_id": controller_id}
        )
        logger.info(f"Control granted to: {controller_id}")

    async def handle_control_released(self, data: dict):
        """Handle control being released"""
        logger.info("Control released")
        self.control_state = ControlState.IDLE
        self.controller_id = None

    async def handle_remote_command(self, data: dict):
        """Relay remote command to central_hub"""
        command = data.get("command")
        command_data = data.get("data", {})

        logger.info(f"Relaying command to central_hub: {command}")

        # Send command to central_hub via HubStateMonitor
        if self.hub_monitor and self.hub_monitor.connected_socket:
            await messages.send_update_state(
                self.hub_monitor.connected_socket,
                {"remote_command": {"command": command, "data": command_data}},
            )

    async def connect_to_public_server(self):
        """Connect to the public server WebSocket"""
        url = self.config.public_server_url
        logger.info(f"Connecting to public server: {url}")

        while self.running:
            try:
                async with websockets.connect(url) as websocket:
                    self.public_ws = websocket
                    logger.info("Connected to public server")

                    # Listen for messages
                    async for message_text in websocket:
                        try:
                            message = json.loads(message_text)
                            await self.handle_public_server_message(message)
                        except json.JSONDecodeError:
                            logger.error(f"Invalid JSON from server: {message_text}")
                        except Exception as e:
                            logger.error(f"Error handling message: {e}")

            except websockets.exceptions.WebSocketException as e:
                logger.error(f"WebSocket error: {e}")
                self.public_ws = None
                if self.running:
                    logger.info("Reconnecting in 5 seconds...")
                    await asyncio.sleep(5)
            except Exception as e:
                logger.error(f"Unexpected error: {e}")
                self.public_ws = None
                if self.running:
                    await asyncio.sleep(5)

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
                self.control_state == ControlState.CONTROLLED
                and self.remote_video_frame is not None
            ):
                self.draw_remote_video(self.remote_video_frame)
            else:
                self.draw_robot_eyes()

            # Limit framerate
            clock.tick(30)  # 30 FPS

    async def async_main(self):
        """Main async loop"""
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
        await self.connect_to_public_server()

    def run(self):
        """Main entry point"""
        self.running = True

        # Initialize pygame in main thread
        self.init_pygame()

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
            pygame.quit()
            logger.info("Shutdown complete")


def main():
    """Entry point"""
    service = PortalbotService()
    service.run()


if __name__ == "__main__":
    main()
