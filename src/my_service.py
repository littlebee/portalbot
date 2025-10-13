#!/usr/bin/env python3
"""

Simple service service example that just sets sets a state key value,
sleeps for a while prints the current local state and then sleeps for a while.

"""
import asyncio
from basic_bot.commons import log
from basic_bot.commons.hub_state import HubState
from basic_bot.commons.hub_state_monitor import HubStateMonitor
import basic_bot.commons.messages as bb_message


# HubState is a class that manages the process local copy of the state.
# Each service runs as a process and  has its own partial or full instance
# of HubState.
hub_state = HubState({"worthless_counter": -999, "worthless_counter_interval": 1.0})

# HubStateMonitor will open a websocket connection to the central hub
# and start a thread to listen for state changes.  The monitor will call,
# on the callback function with the new state before applying the changes to
# the local state.
hub_monitor = HubStateMonitor(
    hub_state,
    # identity of the service
    "my_service",
    # keys to subscribe to
    ["worthless_counter", "worthless_counter_interval", "subsystem_stats"],
    # callback function to call when a message is received
    # Note that when started using bb_start, any standard output or error
    # will be captured and logged to the ./logs directory.
    on_state_update=lambda websocket, msg_type, msg_data: print(
        f"on_message_recv: {msg_type=}, {msg_data=}"
    ),
)
hub_monitor.start()

# If you are creating a service that only consumes state changes and does not
# read any external sensors or data,  You can remove the remaining code
# in this file and replace it with
#
# ```python
#   hub_monitor.thread.join()
# ```
#
# For an example of such a service, see the daphbot_service at:
# https://github.com/littlebee/daphbot-due/blob/aa7ed90d60df33009c5bd252c31fa0fb25076fad/src/daphbot_service.py


async def main() -> None:
    log.info("in my_service:main()")
    i = 0
    while True:
        """
        Replace this with your service logic that sends state
        updates to the central hub from external data or inputs
        like that from motors or sensors
        """
        i += 1
        log.info(f"maybe sending state update {hub_monitor.connected_socket}")
        if hub_monitor.connected_socket:
            await bb_message.send_update_state(
                hub_monitor.connected_socket, {"worthless_counter": i}
            )
        interval = hub_state.state.get("worthless_counter_interval", 1.0)
        await asyncio.sleep(interval)
        log.info(f"my_service state: {hub_state.state}")


log.info("starting my_service via asyncio")
asyncio.run(main())
