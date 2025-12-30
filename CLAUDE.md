# Agent Eval - AI Flow Evaluation Application

## Description
Application for evaluating agent AI flows developed in an internal in-house product application.

## Core Story/Features

### 1. Input Configuration
The application should accept the following inputs:
- Access token
- Base path
- Flow ID (which the application will execute)
- List of questions in JSON format

### 2. Execution and Evaluation Process
The application will:
- Make calls to the provided endpoint
- Retrieve responses
- Construct output in JSON format: `{question, answer, expectedAnswer}`
- Allow users to add a flag indicating whether the answer is good or not
- Implement the ability to call an LLM in the role of "LLM-as-a-judge" which will perform the same evaluation as a human

### 3. Export Functionality
Enable export of the final output

### 4. Database Storage
Enable saving of the final output to a database, where users should be able to:
- Specify the flow name
- Add the entire flow export in JSON format

## Technical Stack

### Language
- TypeScript

### Frontend
- React

### Backend
- NestJS (if needed)

### Repository Structure
- Nx monorepo

## Project Structure
```
agent-eval/
├── apps/
│   ├── frontend/        # React application
│   └── backend/         # NestJS API (if needed)
├── libs/
│   ├── shared/          # Shared utilities and types
│   └── api-client/      # API client library
└── nx.json
```

## Key Functionalities

1. **Flow Execution Engine**
   - Execute AI flows via API calls
   - Handle authentication with access tokens
   - Support configurable base paths and flow IDs

2. **Evaluation System**
   - Manual evaluation (user flags)
   - Automated evaluation (LLM-as-a-judge)
   - Comparison between expected and actual answers

3. **Data Management**
   - JSON-based input/output
   - Database persistence
   - Export capabilities

4. **User Interface**
   - Question/answer review interface
   - Evaluation controls
   - Export and save functionality
