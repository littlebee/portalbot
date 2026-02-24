#!/bin/sh

set -e    # fail on error
set -x    # echo commands

python -m black src/

cd webapp
npm run format-fix

