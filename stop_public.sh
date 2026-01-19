#!/bin/bash

PID_FILE="pids/public_server.pid"

if [[ ! -f "$PID_FILE" ]]; then
    echo "PID file not found: $PID_FILE"
    exit 1
fi

PID=$(cat "$PID_FILE")

if ps -p "$PID" > /dev/null 2>&1; then
    # Kill the process
    kill "$PID"
    echo "Process $PID (public_server) has been stopped."
    rm -f "$PID_FILE"
else
    echo "No process found with PID $PID. Cleaning up PID file."
    rm -f "$PID_FILE"
fi


