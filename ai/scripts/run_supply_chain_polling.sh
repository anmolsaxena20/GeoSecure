#!/bin/bash

# Navigate to the 'ai' root directory relative to the script location
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

if [ "$1" = "--once" ]; then
  echo "[$(date)] Executing Supply Chain LangGraph Polling Agent once..."
  node agents/supply_chain_polling_agent.js --once
  echo "[$(date)] Supply Chain Polling Agent execution complete."
else
  echo "[$(date)] Starting Supply Chain LangGraph Polling Agent daemon..."
  node agents/supply_chain_polling_agent.js
fi
