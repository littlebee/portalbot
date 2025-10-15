"""
Tests for room configuration loading and validation
"""

import os
import tempfile
import pytest
from pathlib import Path

from src.commons.room_config import (
    load_rooms_config,
    RoomConfig,
    RoomsConfiguration,
)


@pytest.fixture
def valid_config_file():
    """Create a temporary valid configuration file"""
    config_content = """
version: "1.0.0"
default_image_url: "/images/default.jpg"
rooms:
  - id: "test-room-1"
    display_name: "Test Room 1"
    description: "Test room description"
    image_url: "/images/room1.jpg"
    max_participants: 2
    enabled: true
  - id: "test-room-2"
    display_name: "Test Room 2"
    description: "Another test room"
    max_participants: 3
    enabled: false
"""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".yml", delete=False) as f:
        f.write(config_content)
        temp_path = f.name

    yield temp_path

    # Cleanup
    os.unlink(temp_path)


@pytest.fixture
def config_without_image_url():
    """Create a config file with room missing image_url"""
    config_content = """
version: "1.0.0"
default_image_url: "/images/default.jpg"
rooms:
  - id: "no-image-room"
    display_name: "No Image Room"
    description: "Room without explicit image"
    max_participants: 2
    enabled: true
"""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".yml", delete=False) as f:
        f.write(config_content)
        temp_path = f.name

    yield temp_path

    os.unlink(temp_path)


@pytest.fixture
def invalid_config_duplicate_ids():
    """Create a config file with duplicate room IDs"""
    config_content = """
version: "1.0.0"
default_image_url: "/images/default.jpg"
rooms:
  - id: "duplicate"
    display_name: "Room 1"
    description: "First room"
    max_participants: 2
    enabled: true
  - id: "duplicate"
    display_name: "Room 2"
    description: "Second room"
    max_participants: 2
    enabled: true
"""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".yml", delete=False) as f:
        f.write(config_content)
        temp_path = f.name

    yield temp_path

    os.unlink(temp_path)


def test_load_valid_config(valid_config_file):
    """Test loading a valid configuration file"""
    config = load_rooms_config(valid_config_file)

    assert config.version == "1.0.0"
    assert config.default_image_url == "/images/default.jpg"
    assert len(config.rooms) == 2

    room1 = config.rooms[0]
    assert room1.id == "test-room-1"
    assert room1.display_name == "Test Room 1"
    assert room1.image_url == "/images/room1.jpg"
    assert room1.max_participants == 2
    assert room1.enabled is True


def test_load_config_file_not_found():
    """Test loading a non-existent configuration file"""
    with pytest.raises(FileNotFoundError):
        load_rooms_config("/nonexistent/path/config.yml")


def test_load_config_with_default_image(config_without_image_url):
    """Test that default image URL is applied when not specified"""
    config = load_rooms_config(config_without_image_url)

    room = config.rooms[0]
    assert room.image_url == "/images/default.jpg"


def test_load_config_with_duplicate_ids(invalid_config_duplicate_ids):
    """Test that duplicate room IDs are rejected"""
    with pytest.raises(ValueError, match="Room IDs must be unique"):
        load_rooms_config(invalid_config_duplicate_ids)


def test_invalid_yaml():
    """Test loading invalid YAML"""
    config_content = "invalid: yaml: content: ["
    with tempfile.NamedTemporaryFile(mode="w", suffix=".yml", delete=False) as f:
        f.write(config_content)
        temp_path = f.name

    try:
        with pytest.raises(ValueError, match="Invalid YAML"):
            load_rooms_config(temp_path)
    finally:
        os.unlink(temp_path)


def test_empty_config_file():
    """Test loading an empty configuration file"""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".yml", delete=False) as f:
        f.write("")
        temp_path = f.name

    try:
        with pytest.raises(ValueError, match="Configuration file is empty"):
            load_rooms_config(temp_path)
    finally:
        os.unlink(temp_path)


def test_get_room_by_id(valid_config_file):
    """Test getting a room by ID"""
    config = load_rooms_config(valid_config_file)

    room = config.get_room_by_id("test-room-1")
    assert room is not None
    assert room.id == "test-room-1"
    assert room.display_name == "Test Room 1"

    # Test non-existent room
    room = config.get_room_by_id("nonexistent")
    assert room is None


def test_get_enabled_rooms(valid_config_file):
    """Test filtering enabled rooms"""
    config = load_rooms_config(valid_config_file)

    enabled = config.get_enabled_rooms()
    assert len(enabled) == 1
    assert enabled[0].id == "test-room-1"
    assert enabled[0].enabled is True


def test_to_dict(valid_config_file):
    """Test converting rooms configuration to dictionary"""
    config = load_rooms_config(valid_config_file)

    data = config.to_dict()

    assert data["version"] == "1.0.0"
    assert len(data["rooms"]) == 2

    room1 = data["rooms"][0]
    assert room1["id"] == "test-room-1"
    assert room1["display_name"] == "Test Room 1"
    assert room1["description"] == "Test room description"
    assert room1["image_url"] == "/images/room1.jpg"
    assert room1["max_participants"] == 2
    assert room1["enabled"] is True


def test_room_id_validation():
    """Test room ID validation rules"""
    # Valid IDs
    valid_room = RoomConfig(
        id="valid-room_123",
        display_name="Valid Room",
        description="Test",
        max_participants=2,
        enabled=True,
    )
    assert valid_room.id == "valid-room_123"

    # Invalid ID with special characters
    with pytest.raises(ValueError, match="alphanumeric characters"):
        RoomConfig(
            id="invalid@room!",
            display_name="Invalid Room",
            description="Test",
            max_participants=2,
            enabled=True,
        )

    # Empty ID
    with pytest.raises(ValueError, match="cannot be empty"):
        RoomConfig(
            id="",
            display_name="Empty ID",
            description="Test",
            max_participants=2,
            enabled=True,
        )


def test_max_participants_validation():
    """Test max_participants validation"""
    # Valid range (2-10)
    room = RoomConfig(
        id="test",
        display_name="Test",
        description="Test",
        max_participants=5,
        enabled=True,
    )
    assert room.max_participants == 5

    # Below minimum
    with pytest.raises(ValueError):
        RoomConfig(
            id="test",
            display_name="Test",
            description="Test",
            max_participants=1,
            enabled=True,
        )

    # Above maximum
    with pytest.raises(ValueError):
        RoomConfig(
            id="test",
            display_name="Test",
            description="Test",
            max_participants=11,
            enabled=True,
        )
