"""
Robot secrets management for Portalbot.

Manages robot authentication secrets stored in separate key files.
Each robot has a unique ID and a corresponding secret key file in robot_secrets/<robot-id>.key
"""

import os
from pathlib import Path
from typing import Dict, Optional


class RobotSecrets:
    """Manages robot secret keys loaded from files"""

    def __init__(self, secrets_dir: Optional[str] = None):
        """
        Initialize the robot secrets manager.

        Args:
            secrets_dir: Directory containing robot secret key files.
                        Defaults to project_root/robot_secrets/
        """
        if secrets_dir is None:
            # Default to project root / robot_secrets
            project_root = Path(__file__).parent.parent.parent
            secrets_dir = os.path.join(project_root, "robot_secrets")

        self.secrets_dir = secrets_dir
        self.secrets: Dict[str, str] = {}
        self._load_secrets()

    def _validate_robot_id(self, robot_id: str) -> bool:
        """
        Validate robot ID format.

        Args:
            robot_id: The robot ID to validate

        Returns:
            True if valid, False otherwise
        """
        if not robot_id or not robot_id.strip():
            return False
        # Allow alphanumeric, hyphens, and underscores
        return all(c.isalnum() or c in "-_" for c in robot_id)

    def _load_secrets(self):
        """Load all robot secrets from the secrets directory"""
        if not os.path.exists(self.secrets_dir):
            print(f"Warning: Robot secrets directory not found: {self.secrets_dir}")
            print("No robots will be able to authenticate.")
            return

        if not os.path.isdir(self.secrets_dir):
            print(f"Error: {self.secrets_dir} exists but is not a directory")
            return

        # Load all .key files
        key_files = [f for f in os.listdir(self.secrets_dir) if f.endswith(".key")]

        for key_file in key_files:
            # Extract robot ID from filename (remove .key extension)
            robot_id = key_file[:-4]  # Remove .key

            # Validate robot ID
            if not self._validate_robot_id(robot_id):
                print(f"Warning: Invalid robot ID in filename: {key_file}")
                continue

            # Read secret key
            key_path = os.path.join(self.secrets_dir, key_file)
            try:
                with open(key_path, "r") as f:
                    secret_key = f.read().strip()

                if not secret_key:
                    print(f"Warning: Empty secret key file: {key_file}")
                    continue

                self.secrets[robot_id] = secret_key
                print(f"Loaded secret key for robot: {robot_id}")

            except Exception as e:
                print(f"Error loading secret key from {key_file}: {e}")

        print(f"Loaded {len(self.secrets)} robot secret keys")

    def get_secret(self, robot_id: str) -> Optional[str]:
        """
        Get the secret key for a robot ID.

        Args:
            robot_id: The robot ID to look up

        Returns:
            The secret key if found, None otherwise
        """
        return self.secrets.get(robot_id)

    def validate_robot(self, robot_id: str, secret_key: str) -> bool:
        """
        Validate a robot's credentials.

        Args:
            robot_id: The robot ID
            secret_key: The secret key to validate

        Returns:
            True if credentials are valid, False otherwise
        """
        stored_secret = self.get_secret(robot_id)
        if stored_secret is None:
            return False
        return stored_secret == secret_key

    def robot_has_access_to_space(
        self, robot_id: str, space_allowed_robots: list
    ) -> bool:
        """
        Check if a robot has access to a space.

        Args:
            robot_id: The robot ID
            space_allowed_robots: List of robot IDs allowed in the space

        Returns:
            True if robot is in the allowed list, False otherwise
        """
        return robot_id in space_allowed_robots

    def get_all_robot_ids(self) -> list:
        """
        Get a list of all known robot IDs.

        Returns:
            List of robot IDs
        """
        return list(self.secrets.keys())


# Global instance (will be initialized by public_server)
_robot_secrets_manager: Optional[RobotSecrets] = None


def init_robot_secrets(secrets_dir: Optional[str] = None) -> RobotSecrets:
    """
    Initialize the global robot secrets manager.

    Args:
        secrets_dir: Directory containing robot secret key files

    Returns:
        Initialized RobotSecrets instance
    """
    global _robot_secrets_manager
    _robot_secrets_manager = RobotSecrets(secrets_dir)
    return _robot_secrets_manager


def get_robot_secrets_manager() -> Optional[RobotSecrets]:
    """
    Get the global robot secrets manager instance.

    Returns:
        RobotSecrets instance or None if not initialized
    """
    return _robot_secrets_manager
