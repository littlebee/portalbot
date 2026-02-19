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
import time
from typing import Optional

import cv2
import numpy as np
import pygame

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
        except Exception as e:
            logger.error(f"Failed to initialize pygame: {e}")
            raise

    def draw_robot_eyes(self):
        """Draw animated robot eyes when idle"""
        if not self.screen:
            return

        # Fill background
        self.screen.fill((20, 20, 40))

        # Simple animated eyes
        center_x = self.display_size // 2
        center_y = self.display_size // 2
        eye_distance = 150
        eye_radius = 60
        pupil_radius = 30

        # Animate pupil position with time
        t = time.time()
        pupil_offset_x = int(20 * np.sin(t * 0.5))
        pupil_offset_y = int(20 * np.cos(t * 0.7))

        # Left eye
        pygame.draw.circle(
            self.screen,
            (255, 255, 255),
            (center_x - eye_distance, center_y),
            eye_radius,
        )
        pygame.draw.circle(
            self.screen,
            (20, 20, 40),
            (center_x - eye_distance + pupil_offset_x, center_y + pupil_offset_y),
            pupil_radius,
        )

        # Right eye
        pygame.draw.circle(
            self.screen,
            (255, 255, 255),
            (center_x + eye_distance, center_y),
            eye_radius,
        )
        pygame.draw.circle(
            self.screen,
            (20, 20, 40),
            (center_x + eye_distance + pupil_offset_x, center_y + pupil_offset_y),
            pupil_radius,
        )

        pygame.display.flip()

    def draw_remote_video(self, frame: np.ndarray):
        """Draw remote operator's video on display"""
        if not self.screen or frame is None:
            return

        try:
            # Detect and extract the largest face
            face_frame = self.extract_largest_face(frame)

            if face_frame is not None:
                display_frame = face_frame
            else:
                # No face detected, show full frame
                display_frame = frame

            # Resize to fit display (square)
            display_frame = cv2.resize(
                display_frame, (self.display_size, self.display_size)
            )

            # Convert to pygame surface
            display_frame = np.rot90(display_frame)
            surface = pygame.surfarray.make_surface(display_frame)

            # Draw to screen
            self.screen.blit(surface, (0, 0))
            pygame.display.flip()

        except Exception as e:
            logger.error(f"Error drawing remote video: {e}")

    def extract_largest_face(self, frame: np.ndarray) -> Optional[np.ndarray]:
        """
        Extract the largest detected face from the frame.
        Returns None if no face is detected.
        """
        if self.face_cascade is None or frame is None:
            return None

        try:
            # Convert to grayscale for detection
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

            # Detect faces
            faces = self.face_cascade.detectMultiScale(
                gray, scaleFactor=1.1, minNeighbors=5, minSize=(100, 100)
            )

            if len(faces) == 0:
                return None

            # Find largest face
            largest_face = max(faces, key=lambda f: f[2] * f[3])
            x, y, w, h = largest_face

            # Extract face region with some padding
            padding = int(w * 0.3)
            x1 = max(0, x - padding)
            y1 = max(0, y - padding)
            x2 = min(frame.shape[1], x + w + padding)
            y2 = min(frame.shape[0], y + h + padding)

            face_frame = frame[y1:y2, x1:x2]
            return face_frame

        except Exception as e:
            logger.error(f"Error in face detection: {e}")
            return None

    def detect_face_present(self, frame: np.ndarray) -> bool:
        """Check if a face is present in the frame"""
        if self.face_cascade is None or frame is None:
            # If we can't detect, assume face is present (fail open)
            return True

        try:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = self.face_cascade.detectMultiScale(
                gray, scaleFactor=1.1, minNeighbors=5, minSize=(100, 100)
            )
            return len(faces) > 0
        except Exception as e:
            logger.error(f"Error detecting face: {e}")
            return True  # Fail open

    def cleanup(self):
        """Clean up pygame resources"""
        if self.screen:
            pygame.quit()
            self.screen = None
