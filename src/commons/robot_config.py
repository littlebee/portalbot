"""
Robot configuration management for Portalbot.

Loads and validates robot configuration from portalbot_robot.yml.
This tells the portalbot service which space it belongs to and how to authenticate.
"""

import os
from pathlib import Path
from typing import List, Optional

import yaml
from pydantic import BaseModel, Field, field_validator
from basic_bot.commons.constants import BB_VISION_PORT


class IceServer(BaseModel):
    """ICE server configuration for WebRTC NAT traversal"""

    urls: str = Field(..., description="STUN/TURN server URL")
    username: Optional[str] = Field(None, description="Username for TURN authentication")
    credential: Optional[str] = Field(
        None, description="Password for TURN authentication"
    )


class RobotConfig(BaseModel):
    """Configuration for a portalbot robot instance"""

    robot_id: str = Field(
        ..., description="Unique robot ID (matches robot_secrets/<robot-id>.key)"
    )
    robot_name: str = Field(
        ..., description="Human-readable robot name (displayed to users)"
    )
    space_id: str = Field(..., description="Space ID this robot belongs to")
    secret_key_file: str = Field(
        ..., description="Path to file containing secret key for authentication"
    )
    public_server_url: str = Field(
        "wss://portalbot.net/ws", description="WebSocket URL of the public server"
    )
    vision_service_url: str = Field(
        default_factory=lambda: f"http://localhost:{BB_VISION_PORT}",
        description="URL of the basic_bot vision service for WebRTC relay",
    )
    ice_servers: List[IceServer] = Field(
        default_factory=lambda: [
            IceServer(urls="stun:stun.l.google.com:19302", username=None, credential=None),
            IceServer(
                urls="turn:ec2-3-134-87-34.us-east-2.compute.amazonaws.com:3478",
                username="user",
                credential="pass",
            ),
        ],
        description="ICE servers for WebRTC NAT traversal (STUN/TURN)",
    )
    display_size: int = Field(
        1080, ge=480, le=2160, description="Size of square display (1080x1080)"
    )

    @field_validator("robot_id")
    @classmethod
    def validate_robot_id(cls, v: str) -> str:
        """Validate robot ID format"""
        if not v or not v.strip():
            raise ValueError("Robot ID cannot be empty")
        # Allow alphanumeric, hyphens, and underscores
        if not all(c.isalnum() or c in "-_" for c in v):
            raise ValueError(
                "Robot ID must contain only alphanumeric characters, hyphens, and underscores"
            )
        return v.strip()

    @field_validator("robot_name")
    @classmethod
    def validate_robot_name(cls, v: str) -> str:
        """Validate robot name format"""
        if not v or not v.strip():
            raise ValueError("Robot name cannot be empty")
        # Allow alphanumeric, hyphens, underscores, and spaces
        if not all(c.isalnum() or c in "-_ " for c in v):
            raise ValueError(
                "Robot name must contain only alphanumeric characters, hyphens, underscores, and spaces"
            )
        return v.strip()

    @field_validator("space_id")
    @classmethod
    def validate_space_id(cls, v: str) -> str:
        """Validate space ID format"""
        if not v or not v.strip():
            raise ValueError("Space ID cannot be empty")
        # Allow alphanumeric, hyphens, and underscores
        if not all(c.isalnum() or c in "-_" for c in v):
            raise ValueError(
                "Space ID must contain only alphanumeric characters, hyphens, and underscores"
            )
        return v.strip()

    def get_secret_key(self) -> str:
        """
        Read and return the secret key from the configured file.

        Returns:
            The secret key as a string

        Raises:
            FileNotFoundError: If the secret key file doesn't exist
            ValueError: If the secret key file is empty or invalid
        """
        if not os.path.exists(self.secret_key_file):
            raise FileNotFoundError(
                f"Secret key file not found: {self.secret_key_file}"
            )

        with open(self.secret_key_file, "r") as f:
            secret_key = f.read().strip()

        if not secret_key:
            raise ValueError(f"Secret key file is empty: {self.secret_key_file}")

        return secret_key


def load_robot_config(config_path: Optional[str] = None) -> RobotConfig:
    """
    Load and validate robot configuration from YAML file.

    Args:
        config_path: Path to the configuration file. If None, uses default location.

    Returns:
        Validated RobotConfig object

    Raises:
        FileNotFoundError: If configuration file doesn't exist
        ValueError: If configuration is invalid
    """
    if config_path is None:
        # Default to project root / portalbot_robot.yml
        config_path = os.path.join(
            Path(__file__).parent.parent.parent, "portalbot_robot.yml"
        )

    if not os.path.exists(config_path):
        raise FileNotFoundError(
            f"Robot configuration file not found: {config_path}. "
            "Please create portalbot_robot.yml in the project root."
        )

    try:
        with open(config_path, "r") as f:
            config_data = yaml.safe_load(f)
    except yaml.YAMLError as e:
        raise ValueError(f"Invalid YAML in configuration file: {e}")

    if not config_data:
        raise ValueError("Configuration file is empty")

    # Validate with Pydantic
    try:
        config = RobotConfig(**config_data)
    except Exception as e:
        raise ValueError(f"Invalid robot configuration: {e}")

    return config
