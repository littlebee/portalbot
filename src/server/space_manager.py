#!/usr/bin/env python3
"""
Space Manager for handling space lifecycle and membership.

Handles:
- Space joining and leaving
- Space validation and capacity management
- Participant tracking per space
- Broadcasting to space members
"""

from typing import Dict, Set, Optional
from fastapi import WebSocket


class SpaceManager:
    """Manages spaces and their participants"""

    def __init__(self, spaces_config, connection_manager):
        """
        Initialize the space manager.

        Args:
            spaces_config: SpacesConfiguration instance
            connection_manager: ConnectionManager instance
        """
        self.spaces_config = spaces_config
        self.connection_manager = connection_manager
        self.active_spaces: Dict[str, Set[str]] = {}  # space_name -> Set[client_id]
        self.servo_configs: Dict[str, dict] = {}  # space_name -> servo_config

    async def join_space(
        self, websocket: WebSocket, client_id: str, space_id: str
    ) -> bool:
        """
        Handle client joining a space.

        Returns True if successful, False otherwise.
        """
        # Validate space exists in configuration
        space_config = self.spaces_config.get_space_by_id(space_id)
        if not space_config:
            await self.connection_manager.send_message(
                websocket,
                "error",
                {
                    "message": f"Space '{space_id}' does not exist. Please select a valid space."
                },
            )
            return False

        # Check if space is enabled
        if not space_config.enabled:
            await self.connection_manager.send_message(
                websocket,
                "error",
                {
                    "message": f"Space '{space_config.display_name}' is currently unavailable."
                },
            )
            return False

        # Initialize space if it doesn't exist
        if space_id not in self.active_spaces:
            self.active_spaces[space_id] = set()

        # Check if space is full using configured max_participants
        if len(self.active_spaces[space_id]) >= space_config.max_participants:
            await self.connection_manager.send_message(
                websocket,
                "error",
                {
                    "message": f"Space is full. Maximum {space_config.max_participants} participants allowed."
                },
            )
            return False

        # Add client to space
        self.active_spaces[space_id].add(client_id)
        self.connection_manager.set_client_space(client_id, space_id)

        print(
            f"Client {client_id} joined space: {space_id} ({space_config.display_name})"
        )

        # Notify the joining client
        await self.connection_manager.send_message(
            websocket,
            "joined_space",
            {
                "space": space_id,
                "participants": len(self.active_spaces[space_id]),
            },
        )
        await self.send_servo_config_to_client(client_id)

        # Notify other participants
        await self.broadcast_to_space(
            space_id,
            "user_joined",
            {"sid": client_id, "participants": len(self.active_spaces[space_id])},
            exclude_client_id=client_id,
        )

        return True

    async def leave_space(self, client_id: str):
        """Handle client leaving a space"""
        space_name = self.connection_manager.get_client_space(client_id)

        if not space_name:
            return

        # Remove client from space
        if space_name in self.active_spaces:
            self.active_spaces[space_name].discard(client_id)

            # Notify other participants
            await self.broadcast_to_space(
                space_name,
                "user_left",
                {"participants": len(self.active_spaces[space_name])},
                exclude_client_id=client_id,
            )

            # Clean up empty spaces
            if len(self.active_spaces[space_name]) == 0:
                del self.active_spaces[space_name]

        self.connection_manager.set_client_space(client_id, None)
        print(f"Client {client_id} left space: {space_name}")

    async def broadcast_to_space(
        self,
        space_name: str,
        message_type: str,
        data: dict,
        exclude_client_id: Optional[str] = None,
    ):
        """Broadcast a message to all clients in a space, optionally excluding one"""
        if space_name not in self.active_spaces:
            return

        for client_id in self.active_spaces[space_name]:
            if client_id != exclude_client_id:
                await self.connection_manager.send_to_client(
                    client_id, message_type, data
                )

    def get_space_participants(self, space_name: str) -> Set[str]:
        """Get list of participants in a space"""
        return self.active_spaces.get(space_name, set())

    def get_stats(self) -> dict:
        """Get space statistics"""
        return {
            "active_spaces": len(self.active_spaces),
            "total_participants": sum(
                len(participants) for participants in self.active_spaces.values()
            ),
        }

    def is_robot_in_space(self, space_name: str, client_id: str) -> bool:
        """Check if a client is a robot in any space"""
        in_space = (
            space_name in self.active_spaces
            and client_id in self.active_spaces[space_name]
        )
        return in_space and self.connection_manager.is_robot(client_id)

    def update_servo_config(self, client_id: str, servo_config: dict):
        """Add or update servo configuration for a space"""
        space_name = self.connection_manager.get_client_space(client_id)
        if not space_name:
            print(f"Cannot add servo config: client {client_id} is not in a space")
            return False
        if not self.is_robot_in_space(space_name, client_id):
            print(f"Unauthorized servo config update attempt from {client_id}")
            return False

        self.servo_configs[space_name] = servo_config
        print(f"Updated servo config for space {space_name}: {servo_config}")
        return True

    async def send_servo_config_to_client(self, client_id: str):
        """Send the current servo config for the client's space"""
        space_name = self.connection_manager.get_client_space(client_id)
        if not space_name:
            print(f"Cannot send servo config: client {client_id} is not in a space")
            return
        servo_config = self.servo_configs.get(space_name)
        if not servo_config:
            print(f"No servo config found for space {space_name}")
            return

        await self.connection_manager.send_to_client(
            client_id, "servo_config", servo_config
        )
