#!/bin/sh

# fail on any error
set -e

echo "Linting with flake8 (Python linter): $(python -m flake8 --version)"
python -m flake8 src

echo "Running mypy (Python typechecker): $(python -m mypy --version)"
python -m mypy src

