#!/bin/bash

# Starts the public signaling / web server

source ~/pyenv/wv/bin/activate

mkdir -p ~/portalbot/logs
mkdir -p ~/portalbot/pids

python src/public_server.py \
    >> ~/portalbot/logs/public_server.log 2>&1 &

echo $! > ~/portalbot/pids/public_server.pid
echo "Portalbot FastAPI server started with PID $(cat ~/portalbot/pids/public_server.pid)"
