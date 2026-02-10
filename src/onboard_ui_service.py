#!/usr/bin/env python3
"""
This service provides

- The onboard UI for the robot.  It displays everything seen on 1080x1080
LCD display on the robot. When a person requests and is granted control, a live
audio/video feed of the person granted control of the robot is shown. When no one
has control, the UI displays an animation of the robot's eyes.

It uses pygame for rendering the UI and handling touch input.
- When a person requests and is granted control, a live audio/video feed of the
person granted control of the robot is shown.
- When no one has control, the UI displays an animation of the robot's eyes.

"""

import asyncio
import logging
import threading

import aiohttp
import cv2
import pygame

from src.ui.robot_display import RobotDisplay
from src.ui.webrtc_peer import WebRTCPeer

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class OnboardUIService:
    """Onboard UI service for the portalbot robot"""

    def __init__(self):
        # State management
        self.running = False

        # Initialize display
        face_cascade = self._load_face_detector()
        self.display = RobotDisplay(face_cascade=face_cascade)
        self.webrtc_peer: WebRTCPeer = WebRTCPeer()

    def _load_face_detector(self):
        """Load OpenCV face detector"""
        try:
            # TODO: I think this requires opencv-contrib-python to be installed as
            # opposed to just opencv-python, verify and document installation steps.
            # Try to load Haar Cascade for face detection
            cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"  # type: ignore
            face_cascade = cv2.CascadeClassifier(cascade_path)
            if face_cascade.empty():
                logger.warning("Failed to load face cascade classifier")
                return None
            else:
                logger.info("Face detector loaded successfully")
                return face_cascade
        except Exception as e:
            logger.warning(f"Could not load face detector: {e}")
            return None

    def ui_loop(self):
        """Run the pygame UI loop in the main thread"""
        clock = pygame.time.Clock()

        while self.running:
            # Handle pygame events
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    self.running = False
                elif event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_ESCAPE:
                        self.running = False

            # Update display based on control state
            if self.webrtc_peer.remote_video_frame is not None:
                self.display.draw_remote_video(self.webrtc_peer.remote_video_frame)
            else:
                self.display.draw_robot_eyes()

            # Limit framerate
            clock.tick(30)  # 30 FPS

    async def async_main(self):
        """Main async loop"""
        # Create HTTP session for vision service communication
        self.http_session = aiohttp.ClientSession()

        try:
            # Keep the async loop running
            while self.running:
                await asyncio.sleep(0.1)

        finally:
            # Clean up HTTP session
            if self.http_session:
                await self.http_session.close()

    def run(self):
        """Main entry point"""
        self.running = True

        # Initialize pygame in main thread
        self.display.init_pygame("Portalbot Onboard UI")

        # Start async loop in a separate thread
        async_thread = threading.Thread(target=lambda: asyncio.run(self.async_main()))
        async_thread.daemon = True
        async_thread.start()

        try:
            # Run UI loop in main thread (pygame requirement)
            self.ui_loop()
        except KeyboardInterrupt:
            logger.info("Shutting down...")
        finally:
            self.running = False
            self.display.cleanup()
            logger.info("Shutdown complete")


def main():
    """Entry point"""
    service = OnboardUIService()
    service.run()


if __name__ == "__main__":
    main()
