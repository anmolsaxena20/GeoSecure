# AI Module (LLM + Agentic AI)

This folder contains all components for the LLM and agentic AI layer.
It is intentionally isolated so existing backend and frontend structure remains unchanged.

## Purpose
- Centralize model configuration
- Organize prompts and agent roles
- Define workflow blueprints
- Separate memory, knowledge, and logs

## Top-level layout
- `configs/` model and tool config templates
- `prompts/` reusable prompt templates
- `agents/` role-wise agent folders
- `workflows/` multi-step orchestration docs
- `memory/` short-term and long-term stores
- `knowledge_base/` project/domain knowledge docs
- `logs/` runtime traces and execution logs
- `tests/` agent flow test cases
