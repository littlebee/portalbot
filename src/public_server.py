#!/usr/bin/env python3
"""
WebRTC Signaling Server - FastAPI + Native WebSockets

Handles WebSocket connections for WebRTC peer signaling
and connections from robots and humans.

This server is run on an EC2 instance and is publicly
accessible.
"""

import os
import sys
import json
import uuid
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.exceptions import HTTPException as StarletteHTTPException


# Add project root to Python path for imports to work when running directly
# This allows running: python src/public_server.py
project_root = Path(__file__).parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from src.commons.space_config import (
    load_spaces_config,
    SpacesConfiguration,
)
from src.commons.robot_secrets import (
    init_robot_secrets,
    RobotSecrets,
)
from src.server.connection_manager import ConnectionManager
from src.server.space_manager import SpaceManager
from src.server.robot_control_handler import RobotControlHandler
from src.server.webrtc_signaling import WebRTCSignaling
from src.commons.logger_utils import get_logger

logger = get_logger("public_server")

load_dotenv()

# Load space configuration
try:
    spaces_config: SpacesConfiguration = load_spaces_config()
    logger.info(f"Loaded {len(spaces_config.spaces)} spaces from configuration")
except Exception as e:
    logger.error(f"Failed to load space configuration: {e}")
    logger.error("Server will not start without valid space configuration.")
    raise

# Initialize robot secrets manager
try:
    robot_secrets_manager: RobotSecrets = init_robot_secrets()
    logger.info(
        f"Loaded {len(robot_secrets_manager.get_all_robot_ids())} robot secrets"
    )
except Exception as e:
    logger.error(f"Failed to load robot secrets: {e}")
    logger.error("Server will not start without valid robot secrets.")
    raise

# Create FastAPI app
app = FastAPI(
    title="Portalbot WebRTC Signaling Server",
    description="Real-time signaling server for WebRTC video chat using native WebSockets",
    version="3.0.0",
)

# Initialize managers
connection_manager = ConnectionManager()
space_manager = SpaceManager(spaces_config, connection_manager)
robot_control_handler = RobotControlHandler(
    spaces_config, robot_secrets_manager, connection_manager, space_manager
)
webrtc_signaling = WebRTCSignaling(connection_manager, space_manager)


class SPAStaticFiles(StaticFiles):
    """Serve index.html for client-side routes while preserving static asset 404s."""

    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code != 404:
                raise

            # Missing files with an extension should stay 404.
            if "." in Path(path).name:
                raise

            return await super().get_response("index.html", scope)


@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    space_stats = space_manager.get_stats()
    conn_stats = connection_manager.get_connection_stats()

    return {
        "status": "healthy",
        "active_spaces": space_stats["active_spaces"],
        "total_participants": space_stats["total_participants"],
        "connected_clients": conn_stats["total_connections"],
    }


@app.get("/spaces")
async def get_spaces():
    """Get list of available spaces"""
    return spaces_config.to_dict()


async def handle_ping(websocket: WebSocket, client_id: str, data: dict):
    """Respond to ping with pong to keep connection alive"""
    await connection_manager.send_message(websocket, "pong", {})


async def handle_join_space(websocket: WebSocket, client_id: str, data: dict):
    """Handle client joining a space"""
    space_id = data.get("space")

    if not space_id:
        await connection_manager.send_message(
            websocket, "error", {"message": "Space ID is required"}
        )
        return

    await space_manager.join_space(websocket, client_id, space_id)


async def handle_leave_space(websocket: WebSocket, client_id: str, data: dict):
    """Handle client leaving a space"""
    await space_manager.leave_space(client_id)


async def handle_message(websocket: WebSocket, client_id: str, message: dict):
    """Route incoming messages to appropriate handlers"""
    message_type: str = str(message.get("type"))
    logger.debug(
        "Received wss message from %s with type=%s",
        client_id,
        message_type,
    )
    data = message.get("data", {})

    handlers = {
        "join_space": handle_join_space,
        "leave_space": handle_leave_space,
        "offer": webrtc_signaling.handle_offer,
        "answer": webrtc_signaling.handle_answer,
        "control_offer": webrtc_signaling.handle_control_offer,
        "control_answer": webrtc_signaling.handle_control_answer,
        "ice_candidate": webrtc_signaling.handle_ice_candidate,
        "ping": handle_ping,
        "robot_identify": robot_control_handler.handle_robot_identify,
        "control_request": robot_control_handler.handle_control_request,
        "control_granted": robot_control_handler.handle_control_granted,
        "control_release": robot_control_handler.handle_control_release,
        "set_angles": robot_control_handler.handle_set_angles,
    }

    handler = handlers.get(message_type)
    if handler:
        await handler(websocket, client_id, data)
    else:
        logger.warning(f"Unknown message type: {message_type}")


async def handle_disconnect(client_id: str):
    """Clean up when a client disconnects"""
    logger.info(f"Client disconnected: {client_id}")

    # Handle robot-specific disconnect
    await robot_control_handler.handle_robot_disconnect(client_id)

    # Handle human-specific disconnect
    await robot_control_handler.handle_human_disconnect(client_id)

    # Leave any space the client was in
    await space_manager.leave_space(client_id)

    # Clean up client tracking
    await connection_manager.cleanup_client(client_id)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Main WebSocket endpoint for signaling"""
    await websocket.accept()

    # Generate unique client ID
    client_id = str(uuid.uuid4())

    # Track this connection
    connection_manager.add_connection(websocket, client_id)

    # Send connected message with client ID
    await connection_manager.send_message(websocket, "connected", {"sid": client_id})

    logger.info(f"Client connected: {client_id}")

    try:
        while True:
            # Receive message from client
            message = await websocket.receive_text()

            # Parse JSON message
            try:
                data = json.loads(message)
                await handle_message(websocket, client_id, data)
            except json.JSONDecodeError:
                logger.error(f"Invalid JSON received from {client_id}")
                await connection_manager.send_message(
                    websocket, "error", {"message": "Invalid JSON"}
                )

    except WebSocketDisconnect:
        await handle_disconnect(client_id)
    except Exception as e:
        logger.error(f"Error in WebSocket connection {client_id}: {e}")
        await handle_disconnect(client_id)
    finally:
        # Clean up connection tracking
        connection_manager.remove_connection(websocket)


# Mount static files and templates from the vite build directory
# Important: Because we are serving static files from the root, this
# must be the last route defined or it will override other routes.
app.mount("/", SPAStaticFiles(directory="webapp/dist/", html=True))

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 5080))
    debug = os.getenv("DEBUG", "False").lower() == "true"

    print(f"Starting WebRTC signaling server on port {port}")
    print(f"Server running in {'DEBUG' if debug else 'PRODUCTION'} mode")
    print(f"WebSocket endpoint: ws://localhost:{port}/ws")
    print(f"API docs available at: http://localhost:{port}/docs")

    uvicorn.run(
        "public_server:app",
        host="0.0.0.0",
        port=port,
        reload=debug,
        log_level="debug" if debug else "info",
    )
