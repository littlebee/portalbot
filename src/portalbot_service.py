#!/usr/bin/env python3
"""
This service provides

- A secure, authenticated WebSocket connection to the public_server.
- A WebRTC audio/video relay from basic_bot.services.vision to the public_server.
- A means for public_server to send remote control commands to the robot; relayed
  to basic_bot.services.central_hub

- When a person requests and is granted control, a live audio/video feed of the
person granted control of the robot is forwarded to the /offer endpoint of the
onboardui_service.

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
from typing import Optional, Callable

import aiohttp
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
        # Maps public server sender IDs to client IDs for relaying WebRTC commands
        self.sender_to_client_id_map: dict[str, str] = {}

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

        # HTTP client for WebRTC relay to vision service
        self.http_session: Optional[aiohttp.ClientSession] = None

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
        sender_id = str(data.get("sid"))

        if not offer:
            logger.error("Received WebRTC offer without offer data")
            return

        vision_url = f"{self.config.vision_service_url}/offer"
        await self.forward_offer(
            vision_url, sender_id, offer, on_answer=self.handle_vision_answer
        )

        # TODO: maybe move this the request control flow instead of
        # doing it for every offer?
        await self.request_offer_from_ui()

    async def handle_vision_answer(self, url: str, sender_id: str, payload: dict):
        """Handle the answer from the vision service and send it to public server"""

        logger.info(f"Received answer from {url}: {payload}")

        answer = payload.get("sdp")
        client_id = payload.get("client_id")
        if client_id:
            self.sender_to_client_id_map[sender_id] = client_id
            logger.debug(
                f"Mapped sender ID {sender_id} to vision client ID {client_id}"
            )
            await self.post_ice_candidates(
                f"{self.config.vision_service_url}/ice_candidate"
            )

        if answer:
            logger.info(f"Received answer from {url}, sending to public server")
            await self.send_to_public_server(
                "answer",
                {
                    "answer": answer,
                    "sid": sender_id,
                },
            )
        else:
            logger.error(f"Answer from {url} missing 'sdp' field: {payload}")

    async def forward_offer(
        self,
        url: str,
        sender_id: str,
        offer: str,
        on_answer: Optional[Callable] = None,
    ):
        """
        Async function to forward the WebRTC offer to the vision or
        onboard UI service and returns the answer to caller.

        :param url: Description
        :type url: str
        :param offer: Description
        :type offer: str
        """
        logger.info(f"Relaying WebRTC offer from {sender_id} to {url}")

        try:
            if not self.http_session:
                logger.error("HTTP session not initialized, cannot relay WebRTC offer")
                return

            payload = offer
            async with self.http_session.post(url, json=payload) as response:
                if response.status == 200:
                    result = await response.json()
                    logger.info(f"Received offer response from {url}: {result}")

                    if on_answer:
                        await on_answer(url, sender_id, result)
                    else:
                        logger.error(
                            f"Service response missing answer field from {url}"
                        )
                else:
                    logger.error(
                        f"Service returned error from {url}: {response.status} - "
                        f"{await response.text()}"
                    )
        except aiohttp.ClientError as e:
            logger.error(f"Failed to connect to service at {url}: {e}")
        except Exception as e:
            logger.error(f"Error relaying WebRTC offer to {url}: {e}")

    async def request_offer_from_ui(
        self,
    ):
        """
        Async function to request an offer from the onboard ui REST
        api and then send the offer to via the 'offer' web socket
        message.
        """
        logger.info("Requesting WebRTC offer from UI")
        url = f"{self.config.onboard_ui_service_url}/offer"

        try:
            if not self.http_session:
                logger.error("HTTP session not initialized, cannot relay WebRTC offer")
                return

            async with self.http_session.get(url) as response:
                if response.status == 200:
                    result = await response.json()
                    logger.info(f"Received offer response from {url}: {result}")
                    await self.send_to_public_server("offer", {"offer": result})
                    # TODO:  does this work when we have just asked for the offer
                    # but not forwarded it to the web app yet?
                    await self.post_ice_candidates(
                        f"{self.config.onboard_ui_service_url}/ice_candidate"
                    )
                else:
                    logger.error(
                        f"Service returned error from {url}: {response.status} - "
                        f"{await response.text()}"
                    )
        except aiohttp.ClientError as e:
            logger.error(f"Failed to connect to service at {url}: {e}")
        except Exception as e:
            logger.error(f"Error relaying WebRTC offer to {url}: {e}")

    async def post_ice_candidates(self, url: str):
        """
        Send ICE candidates from the configuration to the appropriate services.
        """
        ice_servers = self.config.ice_servers
        if not ice_servers:
            logger.warning("No ICE servers configured, skipping sending candidates")
            return

        if not self.http_session:
            logger.error("HTTP session not initialized, cannot send ICE candidates")
            return

        payload = {"ice_servers": ice_servers}

        try:
            logger.info(f"Sending ICE candidates from config to {url}")
            async with self.http_session.post(url, json=payload) as response:
                if response.status == 200:
                    result = await response.json()
                    logger.info(f"Received ICE candidate response from {url}: {result}")
                else:
                    logger.error(
                        f"Service error from {url}: {response.status} - "
                        f"{await response.text()}"
                    )
        except aiohttp.ClientError as e:
            logger.error(f"ClientError while sending ICE candidates to {url}: {e}")
        except Exception as e:
            logger.error(f"Error sending ICE candidates to {url}: {e}")

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
            # WebRTC offer from remote viewer - relay to vision service
            await self.handle_webrtc_offer(data)

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

        # Start async loop in a separate thread
        async_thread = threading.Thread(target=lambda: asyncio.run(self.async_main()))
        async_thread.daemon = True
        async_thread.start()

        try:
            while self.running:
                # Main thread can be used for other tasks if needed
                async_thread.join(1)
        except KeyboardInterrupt:
            logger.info("Shutting down...")
        finally:
            self.running = False
            if self.hub_monitor:
                self.hub_monitor.stop()
            self.ws_client.stop()
            logger.info("Shutdown complete")


def main():
    """Entry point"""
    service = PortalbotService()
    service.run()


if __name__ == "__main__":
    main()
