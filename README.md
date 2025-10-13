
# BASIC_BOT

Replace the contents of this file with your own description, install instructions
etc.

## Starting and stopping.

#### to start all services

From the same directory as this README,
```shell
bb_start
```

#### to stop all services

From the same directory as this README,
```shell
bb_stop
```

#### to start all services at boot on Linux

Add the following line to your `/etc/rc.local`:
```
cd path/to/my_robot_dir && bb_start
```

## uploading to robot host computer

Note that the upload script uses `scp` to copy files which requires SSH.  To test that ssh is setup locally and on your bot, first test that you can use ssh to login like this:
```shell
ssh me@my_robot.local
```
### to upload
```shell
./upload.sh me@my_robot.local /home/me/my_robot_code
```
and follow the examples





