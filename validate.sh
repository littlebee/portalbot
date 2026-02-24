#!/bin/sh

set -e    # fail on error
set -x    # echo commands

./format.sh
./lint.sh
./test.sh
./build.sh