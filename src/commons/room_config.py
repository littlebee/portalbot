"""
Room configuration management for Portalbot.

Loads and validates room definitions from portalbot_rooms.yml.
"""

import os
from typing import List, Optional, Dict
from pathlib import Path

import yaml
from pydantic import BaseModel, Field, field_validator


class RoomConfig(BaseModel):
    """Configuration for a single room"""

    id: str = Field(..., description="Unique room identifier")
    display_name: str = Field(..., description="Human-readable room name")
    description: str = Field(..., description="Room description")
    image_url: Optional[str] = Field(
        None, description="URL to room image (optional, uses default if not set)"
    )
    max_participants: int = Field(
        2, ge=2, le=10, description="Maximum number of participants (2-10)"
    )
    enabled: bool = Field(True, description="Whether the room is currently available")

    @field_validator("id")
    @classmethod
    def validate_id(cls, v: str) -> str:
        """Validate room ID format"""
        if not v or not v.strip():
            raise ValueError("Room ID cannot be empty")
        # Allow alphanumeric, hyphens, and underscores
        if not all(c.isalnum() or c in "-_" for c in v):
            raise ValueError(
                "Room ID must contain only alphanumeric characters, hyphens, and underscores"
            )
        return v.strip()


class RoomsConfiguration(BaseModel):
    """Root configuration containing all rooms"""

    version: str = Field(..., description="Configuration file version")
    default_image_url: str = Field(
        "/images/default-room.jpg", description="Default image for rooms"
    )
    rooms: List[RoomConfig] = Field(..., description="List of available rooms")

    @field_validator("rooms")
    @classmethod
    def validate_unique_ids(cls, v: List[RoomConfig]) -> List[RoomConfig]:
        """Ensure all room IDs are unique"""
        room_ids = [room.id for room in v]
        if len(room_ids) != len(set(room_ids)):
            raise ValueError("Room IDs must be unique")
        return v


def load_rooms_config(config_path: Optional[str] = None) -> RoomsConfiguration:
    """
    Load and validate room configuration from YAML file.

    Args:
        config_path: Path to the configuration file. If None, uses default location.

    Returns:
        Validated RoomsConfiguration object

    Raises:
        FileNotFoundError: If configuration file doesn't exist
        ValueError: If configuration is invalid
    """
    if config_path is None:
        # Default to project root / portalbot_rooms.yml
        config_path = os.path.join(
            Path(__file__).parent.parent.parent, "portalbot_rooms.yml"
        )

    if not os.path.exists(config_path):
        raise FileNotFoundError(
            f"Room configuration file not found: {config_path}. "
            "Please create portalbot_rooms.yml in the project root."
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
        config = RoomsConfiguration(**config_data)
    except Exception as e:
        raise ValueError(f"Invalid room configuration: {e}")

    # Apply default image URL to rooms that don't have one
    for room in config.rooms:
        if room.image_url is None:
            room.image_url = config.default_image_url

    return config


def get_room_by_id(
    config: RoomsConfiguration, room_id: str
) -> Optional[RoomConfig]:
    """
    Get a room configuration by ID.

    Args:
        config: The rooms configuration
        room_id: The room ID to find

    Returns:
        RoomConfig if found, None otherwise
    """
    for room in config.rooms:
        if room.id == room_id:
            return room
    return None


def get_enabled_rooms(config: RoomsConfiguration) -> List[RoomConfig]:
    """
    Get list of enabled rooms.

    Args:
        config: The rooms configuration

    Returns:
        List of enabled rooms
    """
    return [room for room in config.rooms if room.enabled]


def rooms_to_dict(config: RoomsConfiguration) -> Dict:
    """
    Convert rooms configuration to dictionary for API responses.

    Args:
        config: The rooms configuration

    Returns:
        Dictionary representation suitable for JSON serialization
    """
    return {
        "version": config.version,
        "rooms": [
            {
                "id": room.id,
                "display_name": room.display_name,
                "description": room.description,
                "image_url": room.image_url,
                "max_participants": room.max_participants,
                "enabled": room.enabled,
            }
            for room in config.rooms
        ],
    }
