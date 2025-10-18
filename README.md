
# Portalbot

Portalbot is a telepresence robot that anyone on the internet can access and remotely control.

## Usage

Each physical robot (portalbot service) when started:

1. reads configuration from portalbot_robot.yml file.

File is verified by pydantic.  Contents of file tell the onboard_ui service which "space" it belongs to, name and the location of the secret key used by public_server to identify the robot.

2. connects to the public_server via wss://portalbot.net/ws and identifies itself as a robot via a message.

From a desktop or mobile browser, a person

1. opens https://portalbot.net

They see a screen with all of the predefined spaces available and are prompted to enter a space.

2. clicks on a space

The space may have one or more robots in it.  For each robot connected to the space, the user sees an extra large tile with the video from that robot. If only one robot has joined the space.

If the robot is not being controlled by anyone, a "Teleport" button is presented.

3. clicks on Teleport button

To control the robot, user must enable and allow camera and microphone.

4. The person's camera and microphone are requested

If not able to get camera and audio media = not able to control

5. Person is prompted to say their name

The robot onboard_ui software verifies that audio is registering and rejects control if not.

6. The onboard_ui will also attempt to detect a face in the video stream and reject control if no face is present.

The largest detected face is displayed on the round 1080x1080 display of the robot.


