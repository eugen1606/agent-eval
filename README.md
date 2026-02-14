# BenchMark

**AI Flow Evaluation & Benchmarking Platform**

BenchMark is a comprehensive tool for testing, evaluating, and tracking the performance of AI agent flows. Execute your flows against question sets, evaluate responses manually or with LLM-as-judge, and monitor accuracy trends over time.

## Features

- **Flow Execution** - Test AI flows against custom question sets with real-time streaming results
- **Human Evaluation** - Mark responses as correct, partial, or incorrect with severity ratings
- **LLM-as-Judge** - Automated evaluation using GPT-4 or Claude
- **Multi-step Conversations** - Test flows that require conversation context
- **Flow Analytics** - Track accuracy trends across multiple evaluation runs
- **Secure Storage** - Encrypted access tokens, reusable question sets, and saved configurations
- **Multi-user Support** - User authentication with isolated data

## Screenshots

| Evaluation | Dashboard | Analytics |
|------------|-----------|-----------|
| Execute flows and evaluate results | View detailed evaluation breakdown | Track performance over time |

## Quick Start

### Prerequisites

- Node.js 18+
- Yarn
- Docker (for PostgreSQL)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd agent-eval

# Install dependencies
yarn install

# Copy environment file
cp .env.example .env

# Generate encryption keys and update .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"  # JWT_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"  # JWT_REFRESH_SECRET

# Start database
docker-compose up -d postgres

# Start backend
yarn nx serve backend

# Start frontend (new terminal)
yarn nx serve frontend
```

### Access the Application

- **Frontend**: http://localhost:4201
- **Backend API**: http://localhost:3001/api
- **Default Login**: `admin@benchmark.local` / `admin123`

## Usage

### 1. Configure Access Token

Navigate to **Settings > AI Studio Access Tokens** and add your AI flow API token. Tokens are encrypted at rest.

### 2. Set Up Flow Configuration

Go to **Settings > Flow Configs** and save your flow's base path and flow ID for easy reuse.

### 3. Create Question Sets

In **Settings > Question Sets**, create reusable question sets with optional expected answers:

```json
[
  { "question": "What is 2+2?", "expectedAnswer": "4" },
  { "question": "What is the capital of France?", "expectedAnswer": "Paris" }
]
```

### 4. Run Evaluation

Go to **Evaluate**, select your configuration, choose a question set, and click **Execute Flow**. Results stream in real-time.

### 5. Evaluate Responses

Mark each response as:
- **Correct** - Answer is accurate
- **Partial** - Partially correct
- **Incorrect** - Wrong (with severity: Critical, Major, Minor)

### 6. Save & Analyze

Save your evaluation and view it in the **Dashboard**. Use **Flow Analytics** to compare performance across multiple runs.

## Architecture

```
agent-eval/
├── apps/
│   ├── frontend/          # React + Vite application
│   └── backend/           # NestJS API server
├── libs/
│   ├── shared/            # Shared TypeScript types
│   └── api-client/        # HTTP client library
└── docker-compose.yml     # PostgreSQL database
```

### Tech Stack

- **Frontend**: React 18, TypeScript, Vite, React Router
- **Backend**: NestJS, TypeORM, PostgreSQL, JWT Auth
- **Infrastructure**: Docker, Nx Monorepo

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/register` | User registration |
| POST | `/api/flow/execute-stream` | Execute flow (SSE) |
| GET | `/api/evaluations` | List evaluations |
| POST | `/api/evaluations` | Save evaluation |
| GET | `/api/access-tokens` | List tokens |
| GET | `/api/questions` | List question sets |
| GET | `/api/flow-configs` | List flow configs |

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `ENCRYPTION_KEY` | 64-char hex key for token encryption | Yes |
| `JWT_SECRET` | JWT signing secret | Yes |
| `JWT_REFRESH_SECRET` | Refresh token secret | Yes |
| `ADMIN_EMAIL` | Initial admin email | No |
| `ADMIN_PASSWORD` | Initial admin password | No |

## Development

```bash
# Run all builds
yarn nx run-many -t build

# Lint
yarn nx lint frontend
yarn nx lint backend

# Test
yarn nx test shared
yarn nx test api-client

# Generate dependency graph
yarn nx graph
```

## Production Deployment

```bash
# Build and run with Docker Compose
docker-compose -f docker-compose.prod.yml up --build
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Roadmap

See [IDEA.md](IDEA.md) for planned features and ideas.
