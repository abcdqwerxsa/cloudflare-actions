#!/usr/bin/env bash
set -euo pipefail

python3 -m venv .venv
source .venv/bin/activate
python -m pip install --disable-pip-version-check --quiet -r requirements.txt
python main.py
