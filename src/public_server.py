#!/usr/bin/env python3
"""
WebRTC Signaling Server - FastAPI + Native WebSockets

Handles WebSocket connections for WebRTC peer signaling
and connections from robots and humans.

This server is run on an EC2 instance and is publicly
accessible.
"""

import os
import json
import uuid
from typing import Dict, Set, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from dotenv import load_dotenv

load_dotenv()

# Create FastAPI app
app = FastAPI(
    title="Portalbot WebRTC Signaling Server",
    description="Real-time signaling server for WebRTC video chat using native WebSockets",
    version="3.0.0",
)

# Connection and room tracking
connected_clients: Dict[WebSocket, str] = {}  # WebSocket -> client_id
client_rooms: Dict[str, Optional[str]] = {}  # client_id -> room_name
active_rooms: Dict[str, Set[str]] = {}  # room_name -> Set[client_id]
client_websockets: Dict[str, WebSocket] = {}  # client_id -> WebSocket

# Mount static files and templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    """Serve the main application page"""
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    return {
        "status": "healthy",
        "active_rooms": len(active_rooms),
        "total_participants": sum(
            len(participants) for participants in active_rooms.values()
        ),
        "connected_clients": len(connected_clients),
    }


async def send_message(websocket: WebSocket, message_type: str, data: dict):
    """Send a JSON message to a WebSocket client"""
    try:
        await websocket.send_json({"type": message_type, "data": data})
    except Exception as e:
        print(f"Error sending message: {e}")


async def broadcast_to_room(
    room_name: str,
    message_type: str,
    data: dict,
    exclude_client_id: Optional[str] = None,
):
    """Broadcast a message to all clients in a room, optionally excluding one"""
    if room_name not in active_rooms:
        return

    for client_id in active_rooms[room_name]:
        if client_id != exclude_client_id:
            websocket = client_websockets.get(client_id)
            if websocket:
                await send_message(websocket, message_type, data)


async def handle_join_room(websocket: WebSocket, client_id: str, data: dict):
    """Handle client joining a room"""
    room_name = data.get("room")

    if not room_name:
        await send_message(websocket, "error", {"message": "Room name is required"})
        return

    # Initialize room if it doesn't exist
    if room_name not in active_rooms:
        active_rooms[room_name] = set()

    # Check if room is full (max 2 participants)
    if len(active_rooms[room_name]) >= 2:
        await send_message(
            websocket,
            "error",
            {"message": "Room is full. Maximum 2 participants allowed."},
        )
        return

    # Add client to room
    active_rooms[room_name].add(client_id)
    client_rooms[client_id] = room_name

    print(f"Client {client_id} joined room: {room_name}")

    # Determine if this client is the initiator
    is_initiator = len(active_rooms[room_name]) == 1

    # Notify the joining client
    await send_message(
        websocket,
        "joined_room",
        {
            "room": room_name,
            "participants": list(active_rooms[room_name]),
            "is_initiator": is_initiator,
        },
    )

    # Notify other participants
    if not is_initiator:
        await broadcast_to_room(
            room_name,
            "user_joined",
            {"sid": client_id, "participants": list(active_rooms[room_name])},
            exclude_client_id=client_id,
        )


async def handle_leave_room(websocket: WebSocket, client_id: str, data: dict):
    """Handle client leaving a room"""
    room_name = client_rooms.get(client_id)

    if not room_name:
        return

    # Remove client from room
    if room_name in active_rooms:
        active_rooms[room_name].discard(client_id)

        # Notify other participants
        await broadcast_to_room(
            room_name,
            "user_left",
            {"sid": client_id},
            exclude_client_id=client_id,
        )

        # Clean up empty rooms
        if len(active_rooms[room_name]) == 0:
            del active_rooms[room_name]

    client_rooms[client_id] = None
    print(f"Client {client_id} left room: {room_name}")


async def handle_offer(websocket: WebSocket, client_id: str, data: dict):
    """Forward WebRTC offer to the other peer in the room"""
    room_name = client_rooms.get(client_id)
    offer = data.get("offer")

    if not room_name or not offer:
        return

    print(f"Forwarding offer in room: {room_name}")
    await broadcast_to_room(
        room_name,
        "offer",
        {"offer": offer, "sid": client_id},
        exclude_client_id=client_id,
    )


async def handle_answer(websocket: WebSocket, client_id: str, data: dict):
    """Forward WebRTC answer to the other peer in the room"""
    room_name = client_rooms.get(client_id)
    answer = data.get("answer")

    if not room_name or not answer:
        return

    print(f"Forwarding answer in room: {room_name}")
    await broadcast_to_room(
        room_name,
        "answer",
        {"answer": answer, "sid": client_id},
        exclude_client_id=client_id,
    )


async def handle_ice_candidate(websocket: WebSocket, client_id: str, data: dict):
    """Forward ICE candidate to the other peer in the room"""
    room_name = client_rooms.get(client_id)
    candidate = data.get("candidate")

    if not room_name or not candidate:
        return

    print(f"Forwarding ICE candidate in room: {room_name}")
    await broadcast_to_room(
        room_name,
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
        "join_room": handle_join_room,
        "leave_room": handle_leave_room,
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

    # Leave any room the client was in
    room_name = client_rooms.get(client_id)
    if room_name and room_name in active_rooms:
        active_rooms[room_name].discard(client_id)

        # Notify other participants
        await broadcast_to_room(
            room_name,
            "user_left",
            {"sid": client_id},
            exclude_client_id=client_id,
        )

        # Clean up empty rooms
        if len(active_rooms[room_name]) == 0:
            del active_rooms[room_name]

    # Clean up client tracking
    if client_id in client_rooms:
        del client_rooms[client_id]
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
    client_rooms[client_id] = None

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


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 5080))
    debug = os.getenv("DEBUG", "False").lower() == "true"

    print(f"Starting WebRTC signaling server on port {port}")
    print(f"Server running in {'DEBUG' if debug else 'PRODUCTION'} mode")
    print(f"WebSocket endpoint: ws://localhost:{port}/ws")
    print(f"API docs available at: http://localhost:{port}/docs")

    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=port,
        reload=debug,
        log_level="info" if debug else "warning",
    )
