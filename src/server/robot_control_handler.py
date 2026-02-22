#!/usr/bin/env python3
"""
Robot Control Handler for managing robot authentication and control flow.

Handles:
- Robot identification and authentication
- Control request/grant/release workflow
- Remote command forwarding
- Robot-human interaction coordination
"""

from fastapi import WebSocket
from collections import deque
from typing import Deque, Dict, Optional
from src.commons.logger_utils import get_logger

logger = get_logger("robot_control_handler")


class RobotControlHandler:
    """Manages robot authentication and control workflow"""

    def __init__(
        self, spaces_config, robot_secrets_manager, connection_manager, space_manager
    ):
        """
        Initialize the robot control handler.

        Args:
            spaces_config: SpacesConfiguration instance
            robot_secrets_manager: RobotSecrets instance
            connection_manager: ConnectionManager instance
            space_manager: SpaceManager instance
        """
        self.spaces_config = spaces_config
        self.robot_secrets = robot_secrets_manager
        self.connection_manager = connection_manager
        self.space_manager = space_manager
        self.control_queues: Dict[str, Deque[str]] = {}

    def _get_queue(self, space_id: str) -> Deque[str]:
        """Get or create FIFO queue for a space."""
        if space_id not in self.control_queues:
            self.control_queues[space_id] = deque()
        return self.control_queues[space_id]

    def _remove_queued_controller(self, controller_id: str) -> Optional[str]:
        """Remove a controller from whichever queue it is in."""
        for space_id, queue in list(self.control_queues.items()):
            if controller_id in queue:
                queue.remove(controller_id)
                if not queue:
                    del self.control_queues[space_id]
                return space_id
        return None

    def _get_robot_client_id_for_space(self, space_id: str) -> Optional[str]:
        """Find the robot websocket client ID for a space."""
        for robot_client_id, robot_info in self.connection_manager.robot_clients.items():
            if robot_info.get("space") == space_id:
                return robot_client_id
        return None

    async def _grant_control(self, robot_id: str, controller_id: str):
        """Grant control and notify the browser client."""
        self.connection_manager.set_robot_controller(robot_id, controller_id)
        self.connection_manager.register_human(controller_id)

        robot_info = self.connection_manager.get_robot_info(robot_id)
        await self.connection_manager.send_to_client(
            controller_id,
            "control_granted",
            {
                "robot_id": robot_id,
                "robot_name": robot_info["robot_name"] if robot_info else "Unknown",
            },
        )

    async def _grant_next_controller(self, robot_id: str, space_id: str):
        """Pop the next connected requester from the queue and grant control."""
        queue = self.control_queues.get(space_id)
        if queue is None:
            return

        if len(queue) == 0:
            self.control_queues.pop(space_id, None)
            return

        while queue:
            next_controller_id = queue.popleft()
            if self.connection_manager.get_websocket(next_controller_id):
                await self._grant_control(robot_id, next_controller_id)
                break

        if not queue:
            self.control_queues.pop(space_id, None)

    async def handle_robot_identify(
        self, websocket: WebSocket, client_id: str, data: dict
    ):
        """Handle robot identification and authentication"""
        robot_id = data.get("robot_id")
        robot_name = data.get("robot_name")
        space_id = data.get("space")
        secret_key = data.get("secret_key")

        if not robot_id or not robot_name or not space_id or not secret_key:
            await self.connection_manager.send_message(
                websocket,
                "error",
                {
                    "message": "Robot identification requires robot_id, robot_name, space, and secret_key"
                },
            )
            return

        # Validate space exists
        space_config = self.spaces_config.get_space_by_id(space_id)
        if not space_config:
            await self.connection_manager.send_message(
                websocket, "error", {"message": f"Space '{space_id}' does not exist"}
            )
            return

        # Check if robot_id is in space's allowed list
        if not self.robot_secrets.robot_has_access_to_space(
            robot_id, space_config.robot_ids
        ):
            await self.connection_manager.send_message(
                websocket,
                "error",
                {
                    "message": f"Robot '{robot_id}' is not authorized to access space '{space_id}'"
                },
            )
            print(
                f"Robot authentication failed for {robot_id}: not in space's allowed list"
            )
            return

        # Validate robot credentials
        if not self.robot_secrets.validate_robot(robot_id, secret_key):
            await self.connection_manager.send_message(
                websocket, "error", {"message": "Invalid robot credentials"}
            )
            print(f"Robot authentication failed for {robot_id}: invalid secret key")
            return

        # Register as robot
        self.connection_manager.register_robot(client_id, robot_id, robot_name, space_id)

        # Join the space
        success = await self.space_manager.join_space(websocket, client_id, space_id)
        if not success:
            return

        print(
            f"Robot '{robot_name}' (ID: {robot_id}) authenticated and joined space: {space_id}"
        )

        # Send success response
        await self.connection_manager.send_message(
            websocket,
            "joined_space",
            {
                "space": space_id,
                "participants": list(self.space_manager.get_space_participants(space_id)),
                "is_robot": True,
                "robot_id": robot_id,
                "robot_name": robot_name,
            },
        )

        # Notify other participants
        await self.space_manager.broadcast_to_space(
            space_id,
            "robot_joined",
            {"robot_id": robot_id, "robot_name": robot_name, "client_id": client_id},
            exclude_client_id=client_id,
        )

        # If controllers were waiting while robot was offline, grant the first in queue.
        if self.connection_manager.get_robot_controller(client_id) is None:
            await self._grant_next_controller(client_id, space_id)

    async def handle_control_request(
        self, websocket: WebSocket, client_id: str, data: dict
    ):
        """Handle a human requesting control of a robot"""
        space_id = self.connection_manager.get_client_space(client_id)
        if not space_id:
            await self.connection_manager.send_message(
                websocket, "error", {"message": "You must join a space first"}
            )
            return

        robot_id = self._get_robot_client_id_for_space(space_id)
        if not robot_id:
            queue = self._get_queue(space_id)
            if client_id not in queue:
                queue.append(client_id)
            await self.connection_manager.send_message(
                websocket, "control_pending", {"position": list(queue).index(client_id) + 1}
            )
            return

        if self.connection_manager.find_robot_by_controller(client_id):
            await self.connection_manager.send_message(
                websocket, "error", {"message": "You already control a robot"}
            )
            return

        self.connection_manager.register_human(client_id)
        queue = self.control_queues.get(space_id)
        if queue and client_id in queue:
            await self.connection_manager.send_message(
                websocket,
                "control_pending",
                {"position": list(queue).index(client_id) + 1},
            )
            return

        current_controller_id = self.connection_manager.get_robot_controller(robot_id)
        print(f"Human {client_id} requesting control of robot {robot_id}")

        if current_controller_id is None and not queue:
            await self._grant_control(robot_id, client_id)
            return

        queue = self._get_queue(space_id)
        queue.append(client_id)
        await self.connection_manager.send_message(
            websocket, "control_pending", {"position": len(queue)}
        )

    async def handle_control_granted(
        self, websocket: WebSocket, client_id: str, data: dict
    ):
        """Reject client-originated control_granted with high-severity logging."""
        logger.error(
            "Rejected unauthorized client-sent control_granted from %s with payload=%s",
            client_id,
            data,
        )
        await self.connection_manager.send_message(
            websocket,
            "error",
            {"message": "Unauthorized control_granted message rejected"},
        )

    async def handle_control_release(
        self, websocket: WebSocket, client_id: str, data: dict
    ):
        """Handle releasing control of a robot"""
        # Could be called by human or robot

        if self.connection_manager.is_robot(client_id):
            # Robot is releasing control
            robot_id = client_id
            controller_id = self.connection_manager.get_robot_controller(robot_id)
            robot_info = self.connection_manager.get_robot_info(robot_id) or {}
            space_id = robot_info.get("space")
            if controller_id:
                self.connection_manager.set_robot_controller(robot_id, None)
                print(f"Robot {robot_id} released control from human {controller_id}")

                # Notify human
                await self.connection_manager.send_to_client(
                    controller_id, "control_released", {"robot_id": robot_id}
                )
            if space_id:
                await self._grant_next_controller(robot_id, space_id)
        else:
            # Human is releasing control
            human_id = client_id
            self._remove_queued_controller(human_id)
            # Find which robot this human controls
            robot_id = self.connection_manager.find_robot_by_controller(human_id)
            if robot_id:
                robot_info = self.connection_manager.get_robot_info(robot_id) or {}
                space_id = robot_info.get("space")
                self.connection_manager.set_robot_controller(robot_id, None)
                print(f"Human {human_id} released control of robot {robot_id}")

                # Notify robot
                await self.connection_manager.send_to_client(
                    robot_id, "control_released", {"controller_id": human_id}
                )
                if space_id:
                    await self._grant_next_controller(robot_id, space_id)

    async def handle_set_angles(
        self, websocket: WebSocket, client_id: str, data: dict
    ):
        """Handle set_angles command from human to robot"""
        robot_id = data.get("robot_id")
        angles = data.get("angles")  # e.g., {"pan": 90, "tilt": 45}

        if not robot_id or not self.connection_manager.is_robot(robot_id):
            await self.connection_manager.send_message(
                websocket, "error", {"message": "Invalid robot_id"}
            )
            return

        if not angles:
            await self.connection_manager.send_message(
                websocket, "error", {"message": "angles data is required"}
            )
            return

        # Verify this human controls the robot
        controller_id = self.connection_manager.get_robot_controller(robot_id)
        if controller_id != client_id:
            await self.connection_manager.send_message(
                websocket, "error", {"message": "You do not control this robot"}
            )
            return

        # Forward set_angles to robot
        await self.connection_manager.send_to_client(
            robot_id, "set_angles", {"angles": angles}
        )

    async def handle_robot_disconnect(self, client_id: str):
        """Handle robot disconnection"""
        robot_info = self.connection_manager.get_robot_info(client_id)
        if not robot_info:
            return

        print(f"Robot '{robot_info['robot_name']}' disconnected")
        space_id = robot_info.get("space")

        # Release control if any
        controller_id = robot_info.get("controlled_by")
        if controller_id:
            self.connection_manager.set_robot_controller(client_id, None)
            await self.connection_manager.send_to_client(
                controller_id,
                "control_released",
                {"robot_id": client_id, "reason": "Robot disconnected"},
            )

        queue = self.control_queues.pop(space_id, deque()) if space_id else deque()
        for queued_controller_id in queue:
            await self.connection_manager.send_to_client(
                queued_controller_id,
                "control_released",
                {"robot_id": client_id, "reason": "Robot disconnected"},
            )

    async def handle_human_disconnect(self, client_id: str):
        """Handle human disconnection"""
        if not self.connection_manager.is_human(client_id):
            return

        self._remove_queued_controller(client_id)

        # Find and release control of any robots
        robot_id = self.connection_manager.find_robot_by_controller(client_id)
        if robot_id:
            robot_info = self.connection_manager.get_robot_info(robot_id) or {}
            space_id = robot_info.get("space")
            self.connection_manager.set_robot_controller(robot_id, None)
            await self.connection_manager.send_to_client(
                robot_id,
                "control_released",
                {"controller_id": client_id, "reason": "Controller disconnected"},
            )
            if space_id:
                await self._grant_next_controller(robot_id, space_id)
