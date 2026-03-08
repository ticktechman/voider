#!/usr/bin/env bash
###############################################################################
##
##       filename: mouse.sh
##    description:
##        created: 2026/03/08
##         author: ticktechman
##
###############################################################################
# BASE_DIR="/Users/ticktech/usr/project/github/voider/src"
BASE_DIR="$(dirname "${BASH_SOURCE[0]}")"
source "${BASE_DIR}/.venv/bin/activate"
python3 "${BASE_DIR}/mouse.py"
###############################################################################
