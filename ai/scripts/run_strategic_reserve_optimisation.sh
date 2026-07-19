#!/bin/bash

# Navigate to the 'ai' root directory relative to the script location
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

echo "[$(date)] Starting Strategic Reserve Optimisation Agent..."
node agents/strategic_reserve_optimisation_agent.js --run
echo "[$(date)] Strategic Reserve Optimisation Agent completed."
