#!/usr/bin/env python3

import logging
from typing import Optional


import cv2
import numpy as np
import pygame

logger = logging.getLogger(__name__)


class RemoteFace:
    """Manages the robot's pygame display and rendering"""

    def __init__(
        self, screen: pygame.Surface, display_size: int = 1080, face_cascade=None
    ):
        """
        Initialize the robot display.

        Args:
            display_size: Size of the square display (width and height)
            face_cascade: OpenCV cascade classifier for face detection
        """
        self.display_size = display_size
        self.face_cascade = face_cascade
        self.screen = screen

    def render(self, _t: float, frame: np.ndarray) -> bool:
        """Draw remote operator's video on display"""
        if not self.screen or frame is None:
            return False

        try:
            rgb_frame = self.normalize_to_rgb(frame)

            # Detect and extract the largest face
            face_frame = self.extract_largest_face(rgb_frame)

            if face_frame is not None:
                display_frame = face_frame
            else:
                # No face detected, show full frame
                display_frame = rgb_frame

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
            return False

        return True

    def normalize_to_rgb(self, frame: np.ndarray) -> np.ndarray:
        """Normalize incoming frame formats to RGB for rendering and detection."""
        if frame is None:
            raise ValueError("Frame is None")

        # aiortc/pyav yuv420p frame layout as a single 2D array.
        if frame.ndim == 2:
            return cv2.cvtColor(frame, cv2.COLOR_YUV2RGB_I420)

        # 3-channel arrays are treated as already displayable RGB.
        if frame.ndim == 3 and frame.shape[2] == 3:
            return frame

        raise ValueError(f"Unsupported frame shape: {frame.shape}")

    def extract_largest_face(self, frame: np.ndarray) -> Optional[np.ndarray]:
        """
        Extract the largest detected face from the frame.
        Returns None if no face is detected.
        """
        if self.face_cascade is None or frame is None:
            return None

        try:
            # Convert to grayscale for detection
            gray = cv2.cvtColor(frame, cv2.COLOR_RGB2GRAY)

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
            gray = cv2.cvtColor(frame, cv2.COLOR_RGB2GRAY)
            faces = self.face_cascade.detectMultiScale(
                gray, scaleFactor=1.1, minNeighbors=5, minSize=(100, 100)
            )
            return len(faces) > 0
        except Exception as e:
            logger.error(f"Error detecting face: {e}")
            return True  # Fail open
