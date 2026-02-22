import asyncio

from src.server.webrtc_signaling import WebRTCSignaling


class FakeConnectionManager:
    def __init__(self):
        self.client_spaces = {}
        self.robot_clients = {}
        self.sent_to_client = []
        self.sent_to_websocket = []

    def get_client_space(self, client_id):
        return self.client_spaces.get(client_id)

    def get_robot_controller(self, robot_id):
        robot_info = self.robot_clients.get(robot_id)
        if not robot_info:
            return None
        return robot_info.get("controlled_by")

    def is_robot(self, client_id):
        return client_id in self.robot_clients

    async def send_to_client(self, client_id, message_type, data):
        self.sent_to_client.append((client_id, message_type, data))

    async def send_message(self, websocket, message_type, data):
        self.sent_to_websocket.append((websocket, message_type, data))


class FakeSpaceManager:
    async def broadcast_to_space(self, *args, **kwargs):
        raise AssertionError("control routing should not use broadcast")


def build_signaling():
    connection_manager = FakeConnectionManager()
    connection_manager.robot_clients["robot-client"] = {
        "space": "space-a",
        "controlled_by": "human-1",
    }
    connection_manager.client_spaces["human-1"] = "space-a"
    connection_manager.client_spaces["human-2"] = "space-a"
    connection_manager.client_spaces["robot-client"] = "space-a"

    signaling = WebRTCSignaling(connection_manager, FakeSpaceManager())
    return signaling, connection_manager


def test_control_offer_requires_active_controller():
    signaling, connection_manager = build_signaling()

    websocket = object()
    asyncio.run(
        signaling.handle_control_offer(
            websocket,
            "human-2",
            {"offer": {"type": "offer", "sdp": "fake"}},
        )
    )

    assert connection_manager.sent_to_client == []
    assert connection_manager.sent_to_websocket[-1][1] == "error"


def test_control_offer_routes_only_to_robot():
    signaling, connection_manager = build_signaling()

    websocket = object()
    asyncio.run(
        signaling.handle_control_offer(
            websocket,
            "human-1",
            {"offer": {"type": "offer", "sdp": "fake"}},
        )
    )

    assert connection_manager.sent_to_websocket == []
    assert connection_manager.sent_to_client == [
        (
            "robot-client",
            "control_offer",
            {"offer": {"type": "offer", "sdp": "fake"}, "sid": "human-1"},
        )
    ]


def test_control_answer_routes_only_to_active_controller():
    signaling, connection_manager = build_signaling()

    websocket = object()
    asyncio.run(
        signaling.handle_control_answer(
            websocket,
            "robot-client",
            {"answer": "fake-answer"},
        )
    )

    assert connection_manager.sent_to_websocket == []
    assert connection_manager.sent_to_client == [
        (
            "human-1",
            "control_answer",
            {"answer": "fake-answer", "sid": "robot-client"},
        )
    ]
