#!/bin/sh

echo "Stopping services..."
bb_stop $@

echo "Sleeping for 5 seconds"
sleep 5

echo "Starting services..."
bb_start $@
