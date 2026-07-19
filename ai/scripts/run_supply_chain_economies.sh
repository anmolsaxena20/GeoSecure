#!/bin/bash

# Navigate to the 'ai' root directory relative to the script location
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

echo "[$(date)] Starting Supply Chain Economies Agent..."
node agents/supply_chain_economies_agent.js --run
echo "[$(date)] Supply Chain Economies Agent completed."
