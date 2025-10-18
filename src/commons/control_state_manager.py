#!/usr/bin/env python3
"""
Control state management for robot control flow.

Handles:
- Control state transitions (idle, requested, validating, controlled)
- Control request/grant/release workflow
- Remote command relaying to central_hub
"""

import asyncio
import logging
from enum import Enum
from typing import Callable, Optional

logger = logging.getLogger(__name__)


class ControlState(Enum):
    """States for robot control"""

    IDLE = "idle"  # No one controlling, showing robot eyes
    CONTROL_REQUESTED = "control_requested"  # Someone wants control
    VALIDATING = "validating"  # Checking audio and face detection
    CONTROLLED = "controlled"  # Someone is actively controlling


class ControlStateManager:
    """Manages robot control state and workflow"""

    def __init__(
        self,
        on_send_message: Optional[Callable] = None,
        on_relay_command: Optional[Callable] = None,
    ):
        """
        Initialize the control state manager.

        Args:
            on_send_message: Callback for sending messages to public server
                             (async function with signature: message_type, data)
            on_relay_command: Callback for relaying commands to central_hub
                              (async function with signature: command, data)
        """
        self.control_state = ControlState.IDLE
        self.controller_id: Optional[str] = None
        self.on_send_message = on_send_message
        self.on_relay_command = on_relay_command

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
        if self.on_send_message:
            await self.on_send_message(
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

        # Relay command via callback
        if self.on_relay_command:
            await self.on_relay_command(command, command_data)

    def is_controlled(self) -> bool:
        """Check if robot is currently under control"""
        return self.control_state == ControlState.CONTROLLED

    def get_state(self) -> ControlState:
        """Get current control state"""
        return self.control_state

    def get_controller_id(self) -> Optional[str]:
        """Get current controller ID, if any"""
        return self.controller_id

    def reset(self):
        """Reset control state to idle"""
        self.control_state = ControlState.IDLE
        self.controller_id = None
