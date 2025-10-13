#!/bin/sh

# this script is meant to be run from your local development machine.
# it uploads the project to the target machine

if [ $1 == "--help" ]; then
  echo "usage: ./upload.sh IP_ADDRESS_OR_NAME [TARGET_DIR]"
  echo ""
  echo "  IP_ADDRESS_OR_NAME: the IP address or name of the target machine"
  echo "    which may include a username for ssh, ex: user@my_jetson.local"
  echo "    If you are using the same username as locally you can provide"
  echo "    just the IP address or hostname.  ex: my_jetson.local"
  echo ""
  echo "  TARGET_DIR: the directory on the target machine to upload to if not"
  echo "  the default of /home/$USER/basic_bot"
  exit 1
fi

if [ "$1" == "" ]; then
  echo "Error: missing parameter IP_ADDRESS_OR_NAME.  try: sbin/upload.sh --help"
  exit 1
fi
target_host=$1

target_dir="/home/$USER/basic_bot"
if [ "$2" != "" ]; then
  target_dir=$2
fi

# echo on
set -x

TARGET_HOST=$1

rsync --progress --partial \
--exclude=node_modules \
--exclude=persisted_state.json \
--exclude=data/ \
--exclude=recorded_video/ \
--exclude=logs/ \
--exclude=*.pid \
--exclude=__pycache__ \
--exclude=.pytest_cache \
--exclude=.git \
--exclude=*-test-output.* \

# this will remove any old files that are no
# longer in the project, but it is dangerous.
# Uncomment with caution and only if you are
# NOT doing remote editing of files.
# --delete \

-avz . $target_host:$target_dir
