#!/bin/bash

if [ "$(which npm)"=="" ]; then
    echo ""
    echo "******************* WARNNG *******************"
    echo "May fail to build the webapp if npm not found."
    echo "If it fails, please install nodejs."
    echo "*********************************************"
    echo ""
fi


# echo on
set -x
# stop on error
set -e

# TODO : maybe add flake8 tests and black formatting.
#   basic_bot wants to be agnostic to the user preferred python
#   linter, formatter, type checker etc.


cd webapp
npm install
npm run build

