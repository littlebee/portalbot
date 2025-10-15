"""
Tests for space configuration loading and validation
"""

import os
import tempfile
import pytest
from pathlib import Path

from src.commons.space_config import (
    load_spaces_config,
    SpaceConfig,
    SpacesConfiguration,
)


@pytest.fixture
def valid_config_file():
    """Create a temporary valid configuration file"""
    config_content = """
version: "1.0.0"
default_image_url: "/images/default.jpg"
spaces:
  - id: "test-space-1"
    display_name: "Test Space 1"
    description: "Test space description"
    image_url: "/images/space1.jpg"
    max_participants: 2
    enabled: true
  - id: "test-space-2"
    display_name: "Test Space 2"
    description: "Another test space"
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
    """Create a config file with space missing image_url"""
    config_content = """
version: "1.0.0"
default_image_url: "/images/default.jpg"
spaces:
  - id: "no-image-space"
    display_name: "No Image Space"
    description: "Space without explicit image"
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
    """Create a config file with duplicate space IDs"""
    config_content = """
version: "1.0.0"
default_image_url: "/images/default.jpg"
spaces:
  - id: "duplicate"
    display_name: "Space 1"
    description: "First space"
    max_participants: 2
    enabled: true
  - id: "duplicate"
    display_name: "Space 2"
    description: "Second space"
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
    config = load_spaces_config(valid_config_file)

    assert config.version == "1.0.0"
    assert config.default_image_url == "/images/default.jpg"
    assert len(config.spaces) == 2

    space1 = config.spaces[0]
    assert space1.id == "test-space-1"
    assert space1.display_name == "Test Space 1"
    assert space1.image_url == "/images/space1.jpg"
    assert space1.max_participants == 2
    assert space1.enabled is True


def test_load_config_file_not_found():
    """Test loading a non-existent configuration file"""
    with pytest.raises(FileNotFoundError):
        load_spaces_config("/nonexistent/path/config.yml")


def test_load_config_with_default_image(config_without_image_url):
    """Test that default image URL is applied when not specified"""
    config = load_spaces_config(config_without_image_url)

    space = config.spaces[0]
    assert space.image_url == "/images/default.jpg"


def test_load_config_with_duplicate_ids(invalid_config_duplicate_ids):
    """Test that duplicate space IDs are rejected"""
    with pytest.raises(ValueError, match="Space IDs must be unique"):
        load_spaces_config(invalid_config_duplicate_ids)


def test_invalid_yaml():
    """Test loading invalid YAML"""
    config_content = "invalid: yaml: content: ["
    with tempfile.NamedTemporaryFile(mode="w", suffix=".yml", delete=False) as f:
        f.write(config_content)
        temp_path = f.name

    try:
        with pytest.raises(ValueError, match="Invalid YAML"):
            load_spaces_config(temp_path)
    finally:
        os.unlink(temp_path)


def test_empty_config_file():
    """Test loading an empty configuration file"""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".yml", delete=False) as f:
        f.write("")
        temp_path = f.name

    try:
        with pytest.raises(ValueError, match="Configuration file is empty"):
            load_spaces_config(temp_path)
    finally:
        os.unlink(temp_path)


def test_get_space_by_id(valid_config_file):
    """Test getting a space by ID"""
    config = load_spaces_config(valid_config_file)

    space = config.get_space_by_id("test-space-1")
    assert space is not None
    assert space.id == "test-space-1"
    assert space.display_name == "Test Space 1"

    # Test non-existent space
    space = config.get_space_by_id("nonexistent")
    assert space is None


def test_get_enabled_spaces(valid_config_file):
    """Test filtering enabled spaces"""
    config = load_spaces_config(valid_config_file)

    enabled = config.get_enabled_spaces()
    assert len(enabled) == 1
    assert enabled[0].id == "test-space-1"
    assert enabled[0].enabled is True


def test_to_dict(valid_config_file):
    """Test converting spaces configuration to dictionary"""
    config = load_spaces_config(valid_config_file)

    data = config.to_dict()

    assert data["version"] == "1.0.0"
    assert len(data["spaces"]) == 2

    space1 = data["spaces"][0]
    assert space1["id"] == "test-space-1"
    assert space1["display_name"] == "Test Space 1"
    assert space1["description"] == "Test space description"
    assert space1["image_url"] == "/images/space1.jpg"
    assert space1["max_participants"] == 2
    assert space1["enabled"] is True


def test_space_id_validation():
    """Test space ID validation rules"""
    # Valid IDs
    valid_space = SpaceConfig(
        id="valid-space_123",
        display_name="Valid Space",
        description="Test",
        max_participants=2,
        enabled=True,
    )
    assert valid_space.id == "valid-space_123"

    # Invalid ID with special characters
    with pytest.raises(ValueError, match="alphanumeric characters"):
        SpaceConfig(
            id="invalid@space!",
            display_name="Invalid Space",
            description="Test",
            max_participants=2,
            enabled=True,
        )

    # Empty ID
    with pytest.raises(ValueError, match="cannot be empty"):
        SpaceConfig(
            id="",
            display_name="Empty ID",
            description="Test",
            max_participants=2,
            enabled=True,
        )


def test_max_participants_validation():
    """Test max_participants validation"""
    # Valid range (2-10)
    space = SpaceConfig(
        id="test",
        display_name="Test",
        description="Test",
        max_participants=5,
        enabled=True,
    )
    assert space.max_participants == 5

    # Below minimum
    with pytest.raises(ValueError):
        SpaceConfig(
            id="test",
            display_name="Test",
            description="Test",
            max_participants=1,
            enabled=True,
        )

    # Above maximum
    with pytest.raises(ValueError):
        SpaceConfig(
            id="test",
            display_name="Test",
            description="Test",
            max_participants=11,
            enabled=True,
        )
