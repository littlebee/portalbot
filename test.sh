#!/bin/sh

# echo on
set -x
# stop on error
set -e

python -m pytest -vv tests/

cd webapp && npm install && npm run test

