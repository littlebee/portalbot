import time
import basic_bot.test_helpers.central_hub as hub
import basic_bot.test_helpers.start_stop as sst


def setup_module() -> None:
    # start the central hub and any other services needed to test your service
    sst.start_service("central_hub", "python -m basic_bot.services.central_hub")
    sst.start_service("my_service", "python src/my_service.py")


def teardown_module() -> None:
    sst.stop_service("central_hub")
    sst.stop_service("my_service")


class TestMyService:
    def test_worthless_counter(self) -> None:
        """
        Replace this with a test of your real service
        """
        ws = hub.connect()
        hub.send_identity(ws, "worthless counter test")
        hub.send_subscribe(ws, ["worthless_counter"])

        response = hub.recv(ws)
        assert response["type"] == "iseeu"

        # after the first iseeu message all messages should be state updates
        last = None
        assertion_count = 0
        for i in range(5):
            message = hub.recv(ws)
            assert message["type"] == "stateUpdate"
            current_counter_value = message["data"]["worthless_counter"]
            print(f"got state update: {current_counter_value=}")
            if last:
                assert current_counter_value == last + 1
                assertion_count += 1

            last = current_counter_value

            # as long as the service sleeps for a second and we sleep
            # for a second we should get an incremental value each time
            time.sleep(1)

        # just to prove the test is sane
        assert assertion_count == 4

        ws.close()
