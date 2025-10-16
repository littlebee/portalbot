"""
Space configuration management for Portalbot.

Loads and validates space definitions from portalbot_spaces.yml.
"""

import os
from typing import List, Optional, Dict
from pathlib import Path

import yaml
from pydantic import BaseModel, Field, field_validator


class SpaceConfig(BaseModel):
    """Configuration for a single space"""

    id: str = Field(..., description="Unique space identifier")
    display_name: str = Field(..., description="Human-readable space name")
    description: str = Field(..., description="Space description")
    image_url: Optional[str] = Field(
        None, description="URL to space image (optional, uses default if not set)"
    )
    max_participants: int = Field(
        2, ge=2, le=10, description="Maximum number of participants (2-10)"
    )
    enabled: bool = Field(True, description="Whether the space is currently available")

    @field_validator("id")
    @classmethod
    def validate_id(cls, v: str) -> str:
        """Validate space ID format"""
        if not v or not v.strip():
            raise ValueError("Space ID cannot be empty")
        # Allow alphanumeric, hyphens, and underscores
        if not all(c.isalnum() or c in "-_" for c in v):
            raise ValueError(
                "Space ID must contain only alphanumeric characters, hyphens, and underscores"
            )
        return v.strip()


class SpacesConfiguration(BaseModel):
    """Root configuration containing all spaces"""

    version: str = Field(..., description="Configuration file version")
    default_image_url: str = Field(
        "/images/default-space.jpg", description="Default image for spaces"
    )
    spaces: List[SpaceConfig] = Field(..., description="List of available spaces")

    @field_validator("spaces")
    @classmethod
    def validate_unique_ids(cls, v: List[SpaceConfig]) -> List[SpaceConfig]:
        """Ensure all space IDs are unique"""
        space_ids = [space.id for space in v]
        if len(space_ids) != len(set(space_ids)):
            raise ValueError("Space IDs must be unique")
        return v

    def get_space_by_id(self, space_id: str) -> Optional[SpaceConfig]:
        """
        Get a space configuration by ID.

        Args:
            space_id: The space ID to find

        Returns:
            SpaceConfig if found, None otherwise
        """
        for space in self.spaces:
            if space.id == space_id:
                return space
        return None

    def get_enabled_spaces(self) -> List[SpaceConfig]:
        """
        Get list of enabled spaces.

        Returns:
            List of enabled spaces
        """
        return [space for space in self.spaces if space.enabled]

    def to_dict(self) -> Dict:
        """
        Convert spaces configuration to dictionary for API responses.

        Returns:
            Dictionary representation suitable for JSON serialization
        """
        return {
            "version": self.version,
            "spaces": [
                {
                    "id": space.id,
                    "display_name": space.display_name,
                    "description": space.description,
                    "image_url": space.image_url,
                    "max_participants": space.max_participants,
                    "enabled": space.enabled,
                }
                for space in self.spaces
            ],
        }


def load_spaces_config(config_path: Optional[str] = None) -> SpacesConfiguration:
    """
    Load and validate space configuration from YAML file.

    Args:
        config_path: Path to the configuration file. If None, uses default location.

    Returns:
        Validated SpacesConfiguration object

    Raises:
        FileNotFoundError: If configuration file doesn't exist
        ValueError: If configuration is invalid
    """
    if config_path is None:
        # Default to project root / portalbot_spaces.yml
        config_path = os.path.join(
            Path(__file__).parent.parent.parent, "portalbot_spaces.yml"
        )

    if not os.path.exists(config_path):
        raise FileNotFoundError(
            f"Space configuration file not found: {config_path}. "
            "Please create portalbot_spaces.yml in the project root."
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
        config = SpacesConfiguration(**config_data)
    except Exception as e:
        raise ValueError(f"Invalid space configuration: {e}")

    # Apply default image URL to spaces that don't have one
    for space in config.spaces:
        if space.image_url is None:
            space.image_url = config.default_image_url

    return config
