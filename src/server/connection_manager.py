#!/usr/bin/env python3
"""
Connection Manager for WebSocket connections.

Handles:
- WebSocket connection tracking
- Message sending and broadcasting
- Client lifecycle management
- Client type differentiation (robot vs human)
"""

from typing import Dict, Set, Optional
from fastapi import WebSocket


class ConnectionManager:
    """Manages WebSocket connections and message routing"""

    def __init__(self):
        # Connection tracking
        self.connected_clients: Dict[WebSocket, str] = {}  # WebSocket -> client_id
        self.client_websockets: Dict[str, WebSocket] = {}  # client_id -> WebSocket
        self.client_spaces: Dict[str, Optional[str]] = {}  # client_id -> space_name

        # Robot tracking
        self.robot_clients: Dict[str, dict] = {}  # client_id -> robot info
        self.human_clients: Set[str] = set()  # Set of human client_ids

    def add_connection(self, websocket: WebSocket, client_id: str):
        """Register a new connection"""
        self.connected_clients[websocket] = client_id
        self.client_websockets[client_id] = websocket
        self.client_spaces[client_id] = None

    def remove_connection(self, websocket: WebSocket):
        """Remove a connection from tracking"""
        if websocket in self.connected_clients:
            del self.connected_clients[websocket]

    def get_client_id(self, websocket: WebSocket) -> Optional[str]:
        """Get client ID for a WebSocket"""
        return self.connected_clients.get(websocket)

    def get_websocket(self, client_id: str) -> Optional[WebSocket]:
        """Get WebSocket for a client ID"""
        return self.client_websockets.get(client_id)

    def register_robot(
        self, client_id: str, robot_id: str, robot_name: str, space: str
    ):
        """Register a client as a robot"""
        self.robot_clients[client_id] = {
            "robot_id": robot_id,
            "robot_name": robot_name,
            "space": space,
            "controlled_by": None,
        }

    def is_robot(self, client_id: str) -> bool:
        """Check if client is a robot"""
        return client_id in self.robot_clients

    def get_robot_info(self, client_id: str) -> Optional[dict]:
        """Get robot information"""
        return self.robot_clients.get(client_id)

    def set_robot_controller(self, robot_id: str, controller_id: Optional[str]):
        """Set or clear the controller for a robot"""
        if robot_id in self.robot_clients:
            self.robot_clients[robot_id]["controlled_by"] = controller_id

    def get_robot_controller(self, robot_id: str) -> Optional[str]:
        """Get the current controller of a robot"""
        robot_info = self.robot_clients.get(robot_id)
        if robot_info:
            return robot_info.get("controlled_by")
        return None

    def register_human(self, client_id: str):
        """Register a client as human"""
        self.human_clients.add(client_id)

    def is_human(self, client_id: str) -> bool:
        """Check if client is human"""
        return client_id in self.human_clients

    def get_client_space(self, client_id: str) -> Optional[str]:
        """Get the space a client is in"""
        return self.client_spaces.get(client_id)

    def set_client_space(self, client_id: str, space_name: Optional[str]):
        """Set the space for a client"""
        self.client_spaces[client_id] = space_name

    async def send_message(self, websocket: WebSocket, message_type: str, data: dict):
        """Send a JSON message to a WebSocket client"""
        try:
            await websocket.send_json({"type": message_type, "data": data})
        except Exception as e:
            print(f"Error sending message: {e}")

    async def send_to_client(self, client_id: str, message_type: str, data: dict):
        """Send a message to a specific client by ID"""
        websocket = self.get_websocket(client_id)
        if websocket:
            await self.send_message(websocket, message_type, data)

    async def cleanup_client(self, client_id: str):
        """Clean up all tracking for a client"""
        # Remove from robot tracking
        if client_id in self.robot_clients:
            del self.robot_clients[client_id]

        # Remove from human tracking
        self.human_clients.discard(client_id)

        # Remove from client tracking
        if client_id in self.client_spaces:
            del self.client_spaces[client_id]
        if client_id in self.client_websockets:
            del self.client_websockets[client_id]

    def get_connection_stats(self) -> dict:
        """Get connection statistics"""
        return {
            "total_connections": len(self.connected_clients),
            "robot_count": len(self.robot_clients),
            "human_count": len(self.human_clients),
        }

    def find_robot_by_controller(self, controller_id: str) -> Optional[str]:
        """Find which robot a human is controlling"""
        for robot_id, robot_info in self.robot_clients.items():
            if robot_info["controlled_by"] == controller_id:
                return robot_id
        return None
