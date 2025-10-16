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
from typing import Dict, Set, Optional
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

# Add project root to Python path for imports to work when running directly
# This allows running: python src/public_server.py
project_root = Path(__file__).parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from src.commons.space_config import (  # noqa: E402
    load_spaces_config,
    SpacesConfiguration,
)

load_dotenv()

# Load space configuration
try:
    spaces_config: SpacesConfiguration = load_spaces_config()
    print(f"Loaded {len(spaces_config.spaces)} spaces from configuration")
except Exception as e:
    print(f"ERROR: Failed to load space configuration: {e}")
    print("Server will not start without valid space configuration.")
    raise

# Create FastAPI app
app = FastAPI(
    title="Portalbot WebRTC Signaling Server",
    description="Real-time signaling server for WebRTC video chat using native WebSockets",
    version="3.0.0",
)

# Connection and space tracking
connected_clients: Dict[WebSocket, str] = {}  # WebSocket -> client_id
client_spaces: Dict[str, Optional[str]] = {}  # client_id -> space_name
active_spaces: Dict[str, Set[str]] = {}  # space_name -> Set[client_id]
client_websockets: Dict[str, WebSocket] = {}  # client_id -> WebSocket


@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    return {
        "status": "healthy",
        "active_spaces": len(active_spaces),
        "total_participants": sum(
            len(participants) for participants in active_spaces.values()
        ),
        "connected_clients": len(connected_clients),
    }


@app.get("/spaces")
async def get_spaces():
    """Get list of available spaces"""
    return spaces_config.to_dict()


async def send_message(websocket: WebSocket, message_type: str, data: dict):
    """Send a JSON message to a WebSocket client"""
    try:
        await websocket.send_json({"type": message_type, "data": data})
    except Exception as e:
        print(f"Error sending message: {e}")


async def broadcast_to_space(
    space_name: str,
    message_type: str,
    data: dict,
    exclude_client_id: Optional[str] = None,
):
    """Broadcast a message to all clients in a space, optionally excluding one"""
    if space_name not in active_spaces:
        return

    for client_id in active_spaces[space_name]:
        if client_id != exclude_client_id:
            websocket = client_websockets.get(client_id)
            if websocket:
                await send_message(websocket, message_type, data)


async def handle_join_space(websocket: WebSocket, client_id: str, data: dict):
    """Handle client joining a space"""
    space_id = data.get("space")

    if not space_id:
        await send_message(websocket, "error", {"message": "Space ID is required"})
        return

    # Validate space exists in configuration
    space_config = spaces_config.get_space_by_id(space_id)
    if not space_config:
        await send_message(
            websocket,
            "error",
            {"message": f"Space '{space_id}' does not exist. Please select a valid space."},
        )
        return

    # Check if space is enabled
    if not space_config.enabled:
        await send_message(
            websocket,
            "error",
            {"message": f"Space '{space_config.display_name}' is currently unavailable."},
        )
        return

    # Initialize space if it doesn't exist
    if space_id not in active_spaces:
        active_spaces[space_id] = set()

    # Check if space is full using configured max_participants
    if len(active_spaces[space_id]) >= space_config.max_participants:
        await send_message(
            websocket,
            "error",
            {
                "message": f"Space is full. Maximum {space_config.max_participants} participants allowed."
            },
        )
        return

    # Add client to space
    active_spaces[space_id].add(client_id)
    client_spaces[client_id] = space_id

    print(f"Client {client_id} joined space: {space_id} ({space_config.display_name})")

    # Determine if this client is the initiator
    is_initiator = len(active_spaces[space_id]) == 1

    # Notify the joining client
    await send_message(
        websocket,
        "joined_space",
        {
            "space": space_id,
            "participants": list(active_spaces[space_id]),
            "is_initiator": is_initiator,
        },
    )

    # Notify other participants
    if not is_initiator:
        await broadcast_to_space(
            space_id,
            "user_joined",
            {"sid": client_id, "participants": list(active_spaces[space_id])},
            exclude_client_id=client_id,
        )


async def handle_leave_space(websocket: WebSocket, client_id: str, data: dict):
    """Handle client leaving a space"""
    space_name = client_spaces.get(client_id)

    if not space_name:
        return

    # Remove client from space
    if space_name in active_spaces:
        active_spaces[space_name].discard(client_id)

        # Notify other participants
        await broadcast_to_space(
            space_name,
            "user_left",
            {"sid": client_id},
            exclude_client_id=client_id,
        )

        # Clean up empty spaces
        if len(active_spaces[space_name]) == 0:
            del active_spaces[space_name]

    client_spaces[client_id] = None
    print(f"Client {client_id} left space: {space_name}")


async def handle_offer(websocket: WebSocket, client_id: str, data: dict):
    """Forward WebRTC offer to the other peer in the space"""
    space_name = client_spaces.get(client_id)
    offer = data.get("offer")

    if not space_name or not offer:
        return

    print(f"Forwarding offer in space: {space_name}")
    await broadcast_to_space(
        space_name,
        "offer",
        {"offer": offer, "sid": client_id},
        exclude_client_id=client_id,
    )


async def handle_answer(websocket: WebSocket, client_id: str, data: dict):
    """Forward WebRTC answer to the other peer in the space"""
    space_name = client_spaces.get(client_id)
    answer = data.get("answer")

    if not space_name or not answer:
        return

    print(f"Forwarding answer in space: {space_name}")
    await broadcast_to_space(
        space_name,
        "answer",
        {"answer": answer, "sid": client_id},
        exclude_client_id=client_id,
    )


async def handle_ice_candidate(websocket: WebSocket, client_id: str, data: dict):
    """Forward ICE candidate to the other peer in the space"""
    space_name = client_spaces.get(client_id)
    candidate = data.get("candidate")

    if not space_name or not candidate:
        return

    print(f"Forwarding ICE candidate in space: {space_name}")
    await broadcast_to_space(
        space_name,
        "ice_candidate",
        {"candidate": candidate, "sid": client_id},
        exclude_client_id=client_id,
    )


async def handle_ping(websocket: WebSocket, client_id: str, data: dict):
    """Respond to ping with pong to keep connection alive"""
    await send_message(websocket, "pong", {})


async def handle_message(websocket: WebSocket, client_id: str, message: dict):
    """Route incoming messages to appropriate handlers"""
    message_type: str = str(message.get("type"))
    data = message.get("data", {})

    handlers = {
        "join_space": handle_join_space,
        "leave_space": handle_leave_space,
        "offer": handle_offer,
        "answer": handle_answer,
        "ice_candidate": handle_ice_candidate,
        "ping": handle_ping,
    }

    handler = handlers.get(message_type)
    if handler:
        await handler(websocket, client_id, data)
    else:
        print(f"Unknown message type: {message_type}")


async def handle_disconnect(client_id: str):
    """Clean up when a client disconnects"""
    print(f"Client disconnected: {client_id}")

    # Leave any space the client was in
    space_name = client_spaces.get(client_id)
    if space_name and space_name in active_spaces:
        active_spaces[space_name].discard(client_id)

        # Notify other participants
        await broadcast_to_space(
            space_name,
            "user_left",
            {"sid": client_id},
            exclude_client_id=client_id,
        )

        # Clean up empty spaces
        if len(active_spaces[space_name]) == 0:
            del active_spaces[space_name]

    # Clean up client tracking
    if client_id in client_spaces:
        del client_spaces[client_id]
    if client_id in client_websockets:
        del client_websockets[client_id]


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Main WebSocket endpoint for signaling"""
    await websocket.accept()

    # Generate unique client ID
    client_id = str(uuid.uuid4())

    # Track this connection
    connected_clients[websocket] = client_id
    client_websockets[client_id] = websocket
    client_spaces[client_id] = None

    # Send connected message with client ID
    await send_message(websocket, "connected", {"sid": client_id})

    print(f"Client connected: {client_id}")

    try:
        while True:
            # Receive message from client
            message = await websocket.receive_text()

            # Parse JSON message
            try:
                data = json.loads(message)
                await handle_message(websocket, client_id, data)
            except json.JSONDecodeError:
                print(f"Invalid JSON received from {client_id}")
                await send_message(websocket, "error", {"message": "Invalid JSON"})

    except WebSocketDisconnect:
        await handle_disconnect(client_id)
    except Exception as e:
        print(f"Error in WebSocket connection {client_id}: {e}")
        await handle_disconnect(client_id)
    finally:
        # Clean up connection tracking
        if websocket in connected_clients:
            del connected_clients[websocket]


# Mount static files and templates from the vite build directory
# Important: Because we are serving static files from the root, this
# must be the last route defined or it will override other routes.
app.mount("/", StaticFiles(directory="webapp/dist/", html=True))

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
        log_level="info" if debug else "warning",
    )
