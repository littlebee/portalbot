"""
This service provides

- The onboard UI for the robot.  It displays everything seen on 1080x1080.
- A secure, authenticated WebSocket connection to the public_server.
- A WebRTC audio/video relay from basic_bot.services.vision to the public_server.
- A means for public_server to send remote control commands to the robot; relayed
  to basic_bot.services.central_hub

It uses pygame for rendering the UI and handling touch input.
- When a person requests and is granted control, a live audio/video feed of the
person granted control of the robot is shown.
- When no one has control, the UI displays an animation of the robot's eyes.

The service connects to the public_server via a secure WebSocket connection.
The robot identifies itself to public_server via the `join_space` websocket
message using a secret key stored in ./robot_secret.txt.

The service uses aiortc to create a WebRTC connection to public_server for
audio/video streaming. The service relays video from basic_bot.services.vision
and audio from the robot's microphone to public_server.

Over the websocket connection, the service receives remote control commands
from public_server and relays them to basic_bot.services.central_hub via
a local websocket connection.
"""
