import asyncio

from src.server.robot_control_handler import RobotControlHandler


class FakeConnectionManager:
    def __init__(self):
        self.robot_clients = {}
        self.client_spaces = {}
        self.client_websockets = {}
        self.human_clients = set()
        self.sent_to_client = []
        self.sent_to_websocket = []

    def is_robot(self, client_id):
        return client_id in self.robot_clients

    def get_robot_info(self, client_id):
        return self.robot_clients.get(client_id)

    def set_robot_controller(self, robot_id, controller_id):
        self.robot_clients[robot_id]["controlled_by"] = controller_id

    def get_robot_controller(self, robot_id):
        robot_info = self.robot_clients.get(robot_id)
        if not robot_info:
            return None
        return robot_info.get("controlled_by")

    def register_human(self, client_id):
        self.human_clients.add(client_id)

    def is_human(self, client_id):
        return client_id in self.human_clients

    def get_client_space(self, client_id):
        return self.client_spaces.get(client_id)

    def get_websocket(self, client_id):
        return self.client_websockets.get(client_id)

    def find_robot_by_controller(self, controller_id):
        for robot_id, robot_info in self.robot_clients.items():
            if robot_info.get("controlled_by") == controller_id:
                return robot_id
        return None

    async def send_message(self, websocket, message_type, data):
        self.sent_to_websocket.append((websocket, message_type, data))

    async def send_to_client(self, client_id, message_type, data):
        self.sent_to_client.append((client_id, message_type, data))


class FakeSpaceManager:
    pass


def build_handler():
    connection_manager = FakeConnectionManager()
    handler = RobotControlHandler(
        spaces_config=None,
        robot_secrets_manager=None,
        connection_manager=connection_manager,
        space_manager=FakeSpaceManager(),
    )

    robot_client_id = "robot-client"
    connection_manager.robot_clients[robot_client_id] = {
        "robot_id": "robot-1",
        "robot_name": "Portalbot",
        "space": "space-a",
        "controlled_by": None,
    }

    for human_id in ["human-1", "human-2", "human-3"]:
        connection_manager.client_spaces[human_id] = "space-a"
        connection_manager.client_websockets[human_id] = object()

    return handler, connection_manager, robot_client_id


def test_control_queue_grants_in_fifo_order():
    handler, connection_manager, robot_client_id = build_handler()

    websocket_1 = object()
    websocket_2 = object()

    asyncio.run(handler.handle_control_request(websocket_1, "human-1", {}))
    assert connection_manager.get_robot_controller(robot_client_id) == "human-1"
    assert connection_manager.sent_to_client[-1][0:2] == ("human-1", "control_granted")

    asyncio.run(handler.handle_control_request(websocket_2, "human-2", {}))
    assert list(handler.control_queues.get("space-a", [])) == ["human-2"]
    assert connection_manager.sent_to_websocket[-1][1] == "control_pending"

    asyncio.run(handler.handle_control_release(websocket_1, "human-1", {}))
    assert connection_manager.get_robot_controller(robot_client_id) == "human-2"
    assert ("human-2", "control_granted") == connection_manager.sent_to_client[-1][0:2]


def test_controller_disconnect_promotes_next_requester():
    handler, connection_manager, robot_client_id = build_handler()

    websocket_1 = object()
    websocket_2 = object()

    asyncio.run(handler.handle_control_request(websocket_1, "human-1", {}))
    asyncio.run(handler.handle_control_request(websocket_2, "human-2", {}))

    asyncio.run(handler.handle_human_disconnect("human-1"))

    assert connection_manager.get_robot_controller(robot_client_id) == "human-2"
    assert ("human-2", "control_granted") == connection_manager.sent_to_client[-1][0:2]


def test_queued_requester_disconnect_is_removed_from_queue():
    handler, connection_manager, robot_client_id = build_handler()

    websocket_1 = object()
    websocket_2 = object()

    asyncio.run(handler.handle_control_request(websocket_1, "human-1", {}))
    asyncio.run(handler.handle_control_request(websocket_2, "human-2", {}))

    asyncio.run(handler.handle_human_disconnect("human-2"))
    assert list(handler.control_queues.get("space-a", [])) == []

    asyncio.run(handler.handle_control_release(websocket_1, "human-1", {}))
    assert connection_manager.get_robot_controller(robot_client_id) is None
