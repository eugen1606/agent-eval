# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Agent Eval is an AI flow evaluation application for testing agent AI flows. It allows users to execute flows against questions, evaluate responses (manually or via LLM-as-judge), and store/export results.

## Commands

```bash
# Install dependencies
yarn install

# Start database (required for backend)
docker-compose up -d postgres

# Development
yarn nx serve frontend    # Start React frontend (http://localhost:4201)
yarn nx serve backend     # Start NestJS backend (http://localhost:3001/api)

# Build
yarn nx build frontend
yarn nx build backend
yarn nx build shared
yarn nx build api-client

# Build all
yarn nx run-many -t build

# Lint
yarn nx lint frontend
yarn nx lint backend

# Test
yarn nx test shared
yarn nx test api-client

# Docker - Production deployment
docker-compose -f docker-compose.prod.yml up --build
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
- `access-tokens`: Encrypted access token storage (`/api/access-tokens`)
- `questions`: Reusable question sets (`/api/questions`)
- `evaluations`: Stored evaluations with flow exports (`/api/evaluations`)

### Database Entities

- `AccessToken`: Encrypted access tokens (AES-256-GCM)
- `Evaluation`: Final outputs and flow exports
- `QuestionSet`: Reusable question collections
- `FlowConfig`: Saved flow configurations

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

Copy `.env.example` to `.env` and configure:

```bash
# Database
DATABASE_URL=postgresql://agent_eval:agent_eval_password@localhost:5432/agent_eval

# Encryption key for access tokens (64 hex characters)
ENCRYPTION_KEY=<generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">

# LLM API Keys (optional)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
```

## Docker Deployment

```bash
# Development (database only)
docker-compose up -d

# Production (full stack)
docker-compose -f docker-compose.prod.yml up --build
```

## Data Storage

- **Database**: PostgreSQL for access tokens, evaluations, questions, flow configs
- **File-based sessions**: Legacy storage in `data/sessions/` directory

## Git Conventions

- Use short commit messages (one line, under 50 characters)
