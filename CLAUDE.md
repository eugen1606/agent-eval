# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Agent Eval is an AI flow evaluation application for testing agent AI flows. It allows users to execute flows against questions, evaluate responses (manually or via LLM-as-judge), and store/export results.

## Commands

```bash
# Install dependencies
npm install

# Development
npx nx serve frontend    # Start React frontend (http://localhost:4200)
npx nx serve backend     # Start NestJS backend (http://localhost:3000/api)

# Build
npx nx build frontend
npx nx build backend
npx nx build shared
npx nx build api-client

# Build all
npx nx run-many -t build

# Lint
npx nx lint frontend
npx nx lint backend

# Test
npx nx test shared
npx nx test api-client
```

## Architecture

This is an Nx monorepo with the following structure:

- **apps/frontend**: React application (Vite bundler)
- **apps/backend**: NestJS API server
- **libs/shared**: Shared TypeScript types and interfaces
- **libs/api-client**: HTTP client library for frontend-to-backend communication

### Backend API Modules

- `flow`: Executes AI flows against external endpoints (`POST /api/flow/execute`)
- `evaluation`: LLM-as-judge evaluation (`POST /api/evaluate/llm-judge`)
- `sessions`: CRUD operations for evaluation sessions (`/api/sessions`)

### Key Types (libs/shared)

- `FlowConfig`: Access token, base path, flow ID configuration
- `QuestionInput`: Question with optional expected answer
- `EvaluationResult`: Question/answer with evaluation metadata
- `EvaluationSession`: Collection of results with flow configuration

### Frontend Components

- `ConfigurationForm`: Input for flow config and questions JSON
- `FlowExecutor`: Triggers flow execution
- `EvaluationResults`: Displays results with manual/LLM evaluation controls
- `SessionsPanel`: Save/load/export sessions

## Environment Variables

The backend supports these optional environment variables for LLM-as-judge:
- `OPENAI_API_KEY`: For GPT-4 evaluation
- `ANTHROPIC_API_KEY`: For Claude evaluation

If neither is set, mock evaluations are returned.

## Data Storage

Sessions are stored as JSON files in `data/sessions/` directory (file-based storage).
