#!/usr/bin/env python3
"""
WebRTC Signaling Handler for peer-to-peer connection setup.

Handles:
- WebRTC offer/answer forwarding
- ICE candidate exchange
- Peer signaling within spaces
"""

from fastapi import WebSocket


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

    async def handle_offer(self, websocket: WebSocket, client_id: str, data: dict):
        """Forward WebRTC offer to the other peer in the space"""
        space_name = self.connection_manager.get_client_space(client_id)
        offer = data.get("offer")

        if not space_name or not offer:
            return

        print(f"Forwarding offer in space: {space_name}")
        await self.space_manager.broadcast_to_space(
            space_name,
            "offer",
            {"offer": offer, "sid": client_id},
            exclude_client_id=client_id,
        )

    async def handle_answer(self, websocket: WebSocket, client_id: str, data: dict):
        """Forward WebRTC answer to the other peer in the space"""
        space_name = self.connection_manager.get_client_space(client_id)
        answer = data.get("answer")

        if not space_name or not answer:
            return

        print(f"Forwarding answer in space: {space_name}")
        await self.space_manager.broadcast_to_space(
            space_name,
            "answer",
            {"answer": answer, "sid": client_id},
            exclude_client_id=client_id,
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
