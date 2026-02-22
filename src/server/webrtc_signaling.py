#!/usr/bin/env python3
"""
WebRTC Signaling Handler for peer-to-peer connection setup.

Handles:
- WebRTC offer/answer forwarding
- ICE candidate exchange
- Peer signaling within spaces
"""

from fastapi import WebSocket
from typing import Optional
from src.commons.logger_utils import get_logger

logger = get_logger("webrtc_signaling")


class WebRTCSignaling:
    """Handles WebRTC peer signaling"""

    def __init__(self, connection_manager, space_manager):
        """
        Initialize the WebRTC signaling handler.

        Args:
            connection_manager: ConnectionManager instance
            space_manager: SpaceManager instance
        """
        self.connection_manager = connection_manager
        self.space_manager = space_manager

    def _get_robot_client_in_space(self, space_name: str) -> Optional[str]:
        """Return the robot client ID for the given space."""
        for robot_client_id, robot_info in self.connection_manager.robot_clients.items():
            if robot_info.get("space") == space_name:
                return robot_client_id
        return None

    async def handle_offer(self, websocket: WebSocket, client_id: str, data: dict):
        """Forward WebRTC offer to the other peer in the space"""
        space_name = self.connection_manager.get_client_space(client_id)
        offer = data.get("offer")

        if not space_name or not offer:
            logger.error("Received offer without space name or offer data")
            return

        print(f"Forwarding offer in space: {space_name}")
        await self.space_manager.broadcast_to_space(
            space_name,
            "offer",
            {"offer": offer, "sid": client_id},
            exclude_client_id=client_id,
        )

    async def handle_control_offer(
        self, websocket: WebSocket, client_id: str, data: dict
    ):
        """Forward control offer only from active controller to robot."""
        space_name = self.connection_manager.get_client_space(client_id)
        offer = data.get("offer")

        if not space_name or not offer:
            logger.error("Received control offer without space name or offer data")
            return

        robot_client_id = self._get_robot_client_in_space(space_name)
        if not robot_client_id:
            logger.error("No robot connected in space %s for control offer", space_name)
            return

        controller_id = self.connection_manager.get_robot_controller(robot_client_id)
        if controller_id != client_id:
            await self.connection_manager.send_message(
                websocket, "error", {"message": "You do not currently control this robot"}
            )
            return

        print(f"Forwarding control offer in space: {space_name}")
        await self.connection_manager.send_to_client(
            robot_client_id, "control_offer", {"offer": offer, "sid": client_id}
        )

    async def handle_answer(self, websocket: WebSocket, client_id: str, data: dict):
        """Forward WebRTC answer to the other peer in the space"""
        space_name = self.connection_manager.get_client_space(client_id)
        answer = data.get("answer")

        if not space_name or not answer:
            logger.error("Received answer without space name or answer data")
            return

        print(f"Forwarding answer in space: {space_name}")
        # TODO(#12): Send answer only to the original offer sender once
        # targeted routing is implemented for control/view signaling.
        await self.space_manager.broadcast_to_space(
            space_name,
            "answer",
            {"answer": answer, "sid": client_id},
            exclude_client_id=client_id,
        )

    # TODO : DRY up handle_answer and handle_offer since they are almost identical except for the message type and payload key
    async def handle_control_answer(
        self, websocket: WebSocket, client_id: str, data: dict
    ):
        """Forward control answer only from robot to active controller."""
        space_name = self.connection_manager.get_client_space(client_id)
        answer = data.get("answer")

        logger.info(
            f"Handling control answer from client {client_id} in space {space_name}"
        )

        if not space_name or not answer:
            logger.error("Received control answer without space name or answer data")
            return

        if not self.connection_manager.is_robot(client_id):
            await self.connection_manager.send_message(
                websocket,
                "error",
                {"message": "Only robot clients can send control answers"},
            )
            return

        controller_id = self.connection_manager.get_robot_controller(client_id)
        if not controller_id:
            logger.warning(
                "Dropping control answer from %s because no active controller exists",
                client_id,
            )
            return

        print(f"Forwarding answer in space: {space_name}")
        await self.connection_manager.send_to_client(
            controller_id, "control_answer", {"answer": answer, "sid": client_id}
        )

    async def handle_ice_candidate(
        self, websocket: WebSocket, client_id: str, data: dict
    ):
        """Forward ICE candidate to the other peer in the space"""
        space_name = self.connection_manager.get_client_space(client_id)
        candidate = data.get("candidate")

        if not space_name or not candidate:
            return

        print(f"Forwarding ICE candidate in space: {space_name}")
        await self.space_manager.broadcast_to_space(
            space_name,
            "ice_candidate",
            {"candidate": candidate, "sid": client_id},
            exclude_client_id=client_id,
        )
