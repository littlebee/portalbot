#!/bin/sh

echo "Stopping Public Web Server..."
./stop_public.sh

echo "Sleeping for 5 seconds"
sleep 5

echo "Starting Public Web Server..."
./start_public.sh
