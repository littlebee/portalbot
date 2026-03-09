#!/usr/bin/env python3
"""
Robot display module for rendering UI on the robot's screen.

Handles:
- Pygame display initialization
- Animated robot eyes when idle
- Remote operator video display with face detection
- Face extraction and validation
"""

import logging
import sys
import time
from pathlib import Path
from typing import Optional

import numpy as np
import pygame

# Add project root to Python path
project_root = Path(__file__).parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from src.onboard_ui.renderables.lurker_eyes import LurkerEyes
from src.onboard_ui.renderables.remote_face import RemoteFace


logger = logging.getLogger(__name__)


class RobotDisplay:
    """Manages the robot's pygame display and rendering"""

    def __init__(self, display_size: int = 1080, face_cascade=None):
        """
        Initialize the robot display.

        Args:
            display_size: Size of the square display (width and height)
            face_cascade: OpenCV cascade classifier for face detection
        """
        self.display_size = display_size
        self.face_cascade = face_cascade
        self.screen: Optional[pygame.Surface] = None
        self.lurker_eyes: Optional[LurkerEyes] = None
        self.remote_face: Optional[RemoteFace] = None

    def init_pygame(self, window_title: str = "Portalbot"):
        """Initialize pygame display"""
        try:
            pygame.init()
            # Create a square display
            self.screen = pygame.display.set_mode(
                (self.display_size, self.display_size)
            )
            pygame.display.set_caption(window_title)
            logger.info(
                f"Pygame display initialized: {self.display_size}x{self.display_size}"
            )
            self.lurker_eyes = LurkerEyes(self.screen)
            self.remote_face = RemoteFace(
                self.screen,
                display_size=self.display_size,
                face_cascade=self.face_cascade,
            )

        except Exception as e:
            logger.error(f"Failed to initialize pygame: {e}")
            raise

    def draw_robot_eyes(self):
        """Draw animated robot eyes when idle"""
        if not self.screen:
            return

        # Fill background
        self.screen.fill((20, 20, 40))
        if self.lurker_eyes:
            self.lurker_eyes.render(time.time())

        pygame.display.flip()

    def draw_remote_video(self, frame: np.ndarray):
        """Draw remote operator's video on display"""
        if not self.screen or frame is None or not self.remote_face:
            return

        self.remote_face.render(time.time(), frame)

    def cleanup(self):
        """Clean up pygame resources"""
        if self.screen:
            pygame.quit()
            self.screen = None
