import numpy as np
import pygame


class SleepingEyes:
    """Renderable for relaxed sleeping eyes with subtle motion."""

    def __init__(self, screen, display_size: int = 1080):
        self.screen = screen
        self.display_size = display_size

    def render(self, t: float) -> bool:
        """Draw sleeping eyes that feel calm and alive."""
        if not self.screen:
            return False

        center_x = self.display_size // 2
        center_y = self.display_size // 2
        eye_distance = int(self.display_size * 0.14)
        eye_half_width = int(self.display_size * 0.085)

        # Slow breathing motion keeps the expression from feeling lifeless.
        breathe_offset = int(12 * np.sin(t * 0.35))
        line_thickness = max(4, int(8 + 2 * np.sin(t * 0.2)))

        eyelid_color = (240, 240, 250)
        accent_color = (170, 170, 205)

        left_center = (center_x - eye_distance, center_y + breathe_offset)
        right_center = (center_x + eye_distance, center_y + breathe_offset)

        # Draw gently curved closed eyelids.
        for eye_center in (left_center, right_center):
            start = (eye_center[0] - eye_half_width, eye_center[1])
            mid = (eye_center[0], eye_center[1] + int(self.display_size * 0.012))
            end = (eye_center[0] + eye_half_width, eye_center[1])

            pygame.draw.lines(
                self.screen, eyelid_color, False, [start, mid, end], line_thickness
            )

            # A soft under-lid accent helps communicate resting eyes (not "dead").
            accent_y = eye_center[1] + int(self.display_size * 0.022)
            pygame.draw.line(
                self.screen,
                accent_color,
                (eye_center[0] - int(eye_half_width * 0.55), accent_y),
                (eye_center[0] + int(eye_half_width * 0.55), accent_y),
                max(2, line_thickness // 3),
            )

        return True
