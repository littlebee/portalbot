import time
import numpy as np
import pygame


class LurkerEyes:
    """
    This renderable displays the robot's eyes when no one has control of the robot,
    but there are people in the space (lurkers).

    """

    def __init__(self, screen):
        self.screen = screen
        self.display_size = 1080

    def render(self, t: float) -> bool:
        """Draw animated robot eyes when idle"""
        if not self.screen:
            return False

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

        return True
