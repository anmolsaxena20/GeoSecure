# GeoSecure Supply Chain AI Agents Deployment Guide

This directory contains shell scripts to run and schedule all GeoSecure supply chain agents.

## Directory Structure

- `run_disruption_risk.sh`: One-off script to assess and write trade corridor/commodity risk scores.
- `run_supply_chain_economies.sh`: One-off script to analyze macroeconomic indicator changes.
- `run_strategic_reserve_optimisation.sh`: One-off script to optimize strategic reserve levels.
- `run_adaptive_procurement.sh`: One-off script to recommend alternative procurement supplies.
- `run_supply_agent.sh`: Daemon/One-off news polling script.
- `run_supply_chain_polling.sh`: Daemon/One-off LangGraph polling script.
- `deploy_all.sh`: Helper to set permissions and run daemon agents in the background.

---

## 1. Preparing the Server

Before running the scripts, make sure they have execution permissions on your Linux server:

```bash
chmod +x scripts/*.sh
```

---

## 2. Deploying Daemon Agents

The **Supply News Agent** and **Supply Chain Polling Agent** are designed to run continuously, using internal cron schedules (`SUPPLY_CHAIN_CRON` in `.env`).

### Option A: Standard Background Run (nohup)
You can run them in the background using the master script:
```bash
./scripts/deploy_all.sh
```

### Option B: PM2 Process Manager (Recommended for production)
If you have PM2 installed, you can launch the scripts as managed services:
```bash
# Start Supply News Agent daemon
pm2 start agents/supply_agent.js --name "supply-news-agent"

# Start Supply Chain Polling Agent daemon
pm2 start agents/supply_chain_polling_agent.js --name "supply-chain-polling-agent"

# Monitor and save configuration
pm2 status
pm2 save
```

---

## 3. Deploying One-Off Agents (System Cron Tab)

The remaining agents run on-demand and immediately exit upon completing their cycles. Use the server's cron daemon to schedule them.

Open the crontab config file:
```bash
crontab -e
```

Add the following lines (adjust `/path/to/project` to match the absolute path of your `ai` folder):

```text
# =========================================================================
# GeoSecure Supply Chain AI Agent Cron Registry
# =========================================================================

# 1. Run Disruption Risk Agent every hour
0 * * * * /path/to/project/scripts/run_disruption_risk.sh >> /path/to/project/logs/disruption_cron.log 2>&1

# 2. Run Supply Chain Economies Agent every 2 hours
0 */2 * * * /path/to/project/scripts/run_supply_chain_economies.sh >> /path/to/project/logs/economies_cron.log 2>&1

# 3. Run Strategic Reserve Optimisation Agent every 6 hours
0 */6 * * * /path/to/project/scripts/run_strategic_reserve_optimisation.sh >> /path/to/project/logs/strategic_reserve_cron.log 2>&1

# 4. Run Adaptive Procurement Orchestrator every 12 hours
0 */12 * * * /path/to/project/scripts/run_adaptive_procurement.sh >> /path/to/project/logs/procurement_cron.log 2>&1
```

---

## 4. Verification

To check if a script runs correctly and environment variables resolve, execute it directly from the terminal:

```bash
./scripts/run_disruption_risk.sh
```
Check generated outputs in `logs/` directory or run queries on the database.
