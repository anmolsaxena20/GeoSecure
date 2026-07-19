#!/bin/bash

# Navigate to the 'ai' root directory relative to the script location
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

if [ "$1" = "--once" ]; then
  echo "[$(date)] Executing Supply News Agent once..."
  node agents/supply_agent.js --once
  echo "[$(date)] Supply News Agent execution complete."
else
  echo "[$(date)] Starting Supply News Agent daemon..."
  # Executing in foreground or background based on standard CLI call
  node agents/supply_agent.js
fi
