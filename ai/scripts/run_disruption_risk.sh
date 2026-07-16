#!/bin/bash

# Navigate to the 'ai' root directory relative to the script location
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

echo "[$(date)] Starting Disruption Risk Agent..."
node agents/disruption_risk_agent.js --run
echo "[$(date)] Disruption Risk Agent completed."
