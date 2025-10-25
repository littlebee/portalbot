#!/usr/bin/env python3
"""
WebSocket client for connecting the robot to the public server.

Handles:
- Connection management with auto-reconnection
- Robot authentication and identification
- Message routing to appropriate handlers
- Message sending to public server
"""

import asyncio
import json
import logging
from typing import Callable, Optional

import websockets
from websockets.client import WebSocketClientProtocol, connect

logger = logging.getLogger(__name__)


class PortalbotWebSocketClient:
    """WebSocket client for robot-to-server communication"""

    def __init__(
        self,
        server_url: str,
        robot_id: str,
        robot_name: str,
        space_id: str,
        secret_key: str,
        on_message: Optional[Callable] = None,
    ):
        """
        Initialize the WebSocket client.

        Args:
            server_url: WebSocket server URL (e.g., ws://localhost:5080/ws)
            robot_id: Unique robot identifier
            robot_name: Human-readable robot name
            space_id: Space this robot belongs to
            secret_key: Authentication secret
            on_message: Callback for handling incoming messages (async function)
        """
        self.server_url = server_url
        self.robot_id = robot_id
        self.robot_name = robot_name
        self.space_id = space_id
        self.secret_key = secret_key
        self.on_message = on_message

        self.websocket: Optional[WebSocketClientProtocol] = None
        self.running = False

    async def send_message(self, message_type: str, data: dict):
        """Send a message to the public server"""
        if not self.websocket:
            logger.warning("Cannot send message - not connected to public server")
            return

        try:
            message = {"type": message_type, "data": data}
            await self.websocket.send(json.dumps(message))
            logger.debug(f"Sent to public server: {message_type}")
        except Exception as e:
            logger.error(f"Error sending to public server: {e}")

    async def identify_as_robot(self):
        """Send robot identification to public server"""
        await self.send_message(
            "robot_identify",
            {
                "robot_id": self.robot_id,
                "robot_name": self.robot_name,
                "space": self.space_id,
                "secret_key": self.secret_key,
            },
        )

    async def handle_message(self, message: dict):
        """
        Handle incoming messages from the public server.

        Delegates to the on_message callback if provided.
        """
        message_type = message.get("type")
        data = message.get("data", {})

        logger.info(f"Received from public server: {message_type}")

        # Handle connection acknowledgment
        if message_type == "connected":
            # Server acknowledged connection, now identify as robot and join space
            await self.identify_as_robot()

        # Delegate other messages to callback
        if self.on_message:
            await self.on_message(message_type, data)

    async def connect(self):
        """
        Connect to the public server WebSocket.

        Maintains connection with auto-reconnection on failure.
        """
        logger.info(f"Connecting to public server: {self.server_url}")
        self.running = True

        while self.running:
            try:
                async with connect(self.server_url) as websocket:
                    self.websocket = websocket
                    logger.info("Connected to public server")

                    # Listen for messages
                    async for message_data in websocket:
                        try:
                            # Handle both text and binary messages
                            message_text = (
                                message_data.decode("utf-8")
                                if isinstance(message_data, bytes)
                                else message_data
                            )
                            message = json.loads(message_text)
                            await self.handle_message(message)
                        except json.JSONDecodeError:
                            logger.error(f"Invalid JSON from server: {message_text}")
                        except UnicodeDecodeError:
                            logger.error(f"Invalid UTF-8 in message: {message_data!r}")
                        except Exception as e:
                            logger.error(f"Error handling message: {e}")

            except websockets.exceptions.WebSocketException as e:
                logger.error(f"WebSocket error: {e}")
                self.websocket = None
                if self.running:
                    logger.info("Reconnecting in 5 seconds...")
                    await asyncio.sleep(5)
            except Exception as e:
                logger.error(f"Unexpected error: {e}")
                self.websocket = None
                if self.running:
                    await asyncio.sleep(5)

    def stop(self):
        """Stop the WebSocket client"""
        self.running = False
        if self.websocket:
            asyncio.create_task(self.websocket.close())
