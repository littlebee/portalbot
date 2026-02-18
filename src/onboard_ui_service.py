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
import sys
from pathlib import Path
import threading

from fastapi import FastAPI
import pygame

# Add project root to Python path
project_root = Path(__file__).parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from src.commons.face_detector import load_face_detector
from src.ui.robot_display import RobotDisplay
from src.ui.webrtc_peer import WebRTCPeer
from src.commons.constants import PB_ONBOARD_UI_PORT
from src.commons.logger_utils import get_logger

logger = get_logger("onboard_ui_service")

running = True

app = FastAPI(
    title="Portalbot Onboard UI Service",
    description="Real-time signaling server for WebRTC video chat using native WebSockets",
    version="3.0.0",
)

face_cascade = load_face_detector()
display = RobotDisplay(face_cascade=face_cascade)
webrtc_peer: WebRTCPeer = WebRTCPeer()


def shutdown():
    """Cleanly shutdown the service"""
    global running
    running = False
    webrtc_peer.full_stop()
    display.cleanup()


def ui_loop():
    global running
    """Run the pygame UI loop in the main thread"""
    clock = pygame.time.Clock()

    while running:
        # Handle pygame events
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    running = False

        if webrtc_peer.remote_video_frame is not None:
            display.draw_remote_video(webrtc_peer.remote_video_frame)
        else:
            display.draw_robot_eyes()

        # Limit framerate
        clock.tick(30)  # 30 FPS


def ui_thread():
    global running
    running = True

    # Initialize pygame in main thread
    display.init_pygame("Portalbot Onboard UI")
    try:
        # Run UI loop in main thread (pygame requirement)
        ui_loop()
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        shutdown()
    finally:
        logger.info("Shutdown complete")


@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    return {"status": "healthy"}


@app.get("/offer")
async def create_webrtc_offer():
    """Endpoint to create WebRTC offer"""
    offer = await webrtc_peer.create_offer()
    return {"sdp": offer.sdp, "type": offer.type}


@app.post("/answer")
async def receive_webrtc_answer(data: dict):
    """Endpoint to receive WebRTC answer from portalbot_service"""
    logger.info(f"Received WebRTC answer from portalbot service: {data}")
    await webrtc_peer.handle_answer(data)
    return {"status": "Answer received"}


@app.post("/ice_candidate")
async def receive_ice_candidate(data: dict):
    """Endpoint to receive ICE candidate forwarded from portalbot_service"""
    logger.info(f"Received ICE candidate from portalbot service: {data}")
    await webrtc_peer.handle_ice_candidate(data)
    return {"status": "ICE candidate received"}


if __name__ == "__main__":
    import uvicorn

    port = PB_ONBOARD_UI_PORT
    debug = True  # BB_ENV != "production"

    logger.info("Starting ui thread")
    thread = threading.Thread(target=ui_thread)
    thread.start()

    print(f"Starting onboard UI service on port {port}")
    print(f"Server running in {'DEBUG' if debug else 'PRODUCTION'} mode")

    logger.info(
        f"Starting Portalbot Onboard UI Service on port {port} in {'DEBUG' if debug else 'PRODUCTION'} mode"
    )
    uvicorn.run(
        "onboard_ui_service:app",
        host="0.0.0.0",
        port=port,
        log_level="debug" if debug else "info",
    )
