#!/bin/bash

# Navigate to the 'ai' root directory relative to the script location
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

echo "====================================================="
echo "   GeoSecure Supply Chain AI Agents Deployment Hub   "
echo "====================================================="

# Ensure executable permissions
echo "Setting executable permissions on all scripts..."
chmod +x scripts/*.sh

# Create log folders if not present
mkdir -p logs

# Start Daemon Polling Agents in the background using nohup
echo "Starting Daemon Agents in background..."

# 1. Supply News Polling Agent
if pgrep -f "agents/supply_agent.js" > /dev/null; then
  echo "[-] Supply News Agent daemon is already running."
else
  echo "[+] Starting Supply News Agent..."
  nohup node agents/supply_agent.js > logs/supply_agent_daemon.log 2>&1 &
  echo "    Started! Logs: logs/supply_agent_daemon.log"
fi

# 2. Supply Chain Polling Agent
if pgrep -f "agents/supply_chain_polling_agent.js" > /dev/null; then
  echo "[-] Supply Chain Polling Agent daemon is already running."
else
  echo "[+] Starting Supply Chain Polling Agent..."
  nohup node agents/supply_chain_polling_agent.js > logs/supply_chain_polling_daemon.log 2>&1 &
  echo "    Started! Logs: logs/supply_chain_polling_daemon.log"
fi

echo ""
echo "====================================================="
echo "  Daemons deployed successfully."
echo "  Note: To verify active processes, run: ps aux | grep node"
echo "====================================================="
