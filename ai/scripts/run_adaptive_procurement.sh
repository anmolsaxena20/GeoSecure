#!/bin/bash

# Navigate to the 'ai' root directory relative to the script location
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

echo "[$(date)] Starting Adaptive Procurement Orchestrator..."
node agents/adaptive_procurement_orchestrator.js --run
echo "[$(date)] Adaptive Procurement Orchestrator completed."
