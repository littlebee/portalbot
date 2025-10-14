import basic_bot.test_helpers.central_hub as hub
import basic_bot.test_helpers.start_stop as sst


def setup_module() -> None:
    # start the central hub and any other services needed to test your service
    sst.start_service("central_hub", "python -m basic_bot.services.central_hub")


def teardown_module() -> None:
    sst.stop_service("central_hub")


class TestMyService:
    def test_worthlessness(self) -> None:
        """
        Replace this with a test of your real service
        """
        ws = hub.connect()
        hub.send_identity(ws, "worthless counter test")
        hub.send_subscribe(ws, ["worthless_counter"])

        assert True
