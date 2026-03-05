
# Portalbot

Portalbot is a telepresence robot that anyone on the internet can access and remotely control.

## Usage

From a desktop or mobile browser, a person

1. opens https://portalbot.net

They see a screen with all of the predefined spaces available and are prompted to enter a space.

2. clicks on a space

Each space has one robot in it.  The user sees the video and hears the audio from that robot.

3. clicks on "Request Control" button

To control the robot, user must enable and allow camera and microphone.

4. The person's camera and microphone are requested

If not able to get camera and audio media = not able to control

5. Person is prompted to say their name

The robot onboard_ui software verifies that audio is registering and rejects control if not.

6. The onboard_ui will also attempt to detect a face in the video stream and reject control if no face is present.

The largest detected face is displayed on the round 1080x1080 display of the robot.

## How it works

See AGENTS.md for more information on the components of this project.

![Network Diagram](https://github.com/littlebee/portalbot/blob/main/docs/media/portal_bot%20network%20diagram.png)


