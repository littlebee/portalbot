#!/bin/bash

# Starts the public signaling / web server

source ~/pyenv/wv/bin/activate

mkdir -p ~/walky_valky/logs
mkdir -p ~/walky_valky/pids

# Start with uvicorn for FastAPI with native WebSockets
uvicorn public_server:app \
    --host 0.0.0.0 \
    --port ${PORT:-5080} \
    --log-level warning \
    >> ~/walky_valky/logs/public_server.log 2>&1 &

echo $! > ~/walky_valky/pids/public_server.pid
echo "Walky Valky FastAPI server started with PID $(cat ~/walky_valky/pids/public_server.pid)"

