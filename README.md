# Hiring Pipeline

Hiring Pipeline is a web-based recruitment management application designed to help recruiters and interviewers manage jobs, candidates, interviews, feedback, and the overall recruitment workflow.

## Project Status

The project is currently under development.

### Current Phase

**Phase 2 — Architecture and Backend Foundation**

## Technology Stack

### Frontend

- React
- TypeScript
- Vite
- CSS

### Backend

- Node.js
- Express.js
- TypeScript
- CORS
- dotenv

### Planned Database

- PostgreSQL
- Prisma ORM

## Project Architecture

```text
                    Hiring Pipeline
                          |
             +------------+------------+
             |                         |
          Frontend                  Backend
             |                         |
      React + TypeScript         Node.js + Express
             |                         |
             +----------- API ---------+
                          |
                     PostgreSQL
                  (planned/next phase)
```

## Project Structure

```text
hiring-pipeline/
|
+-- frontend/
|
+-- backend/
|
+-- docs/
|   +-- architecture.md
|   +-- schema.md
|   +-- decisions.md
|   +-- plan.md
|   +-- ai-prompts.md
|
+-- .env.example
+-- .gitignore
+-- README.md
+-- SUBMISSION.md
```

## Getting Started

### Prerequisites

Make sure the following are installed:

- Node.js
- npm
- Git

### Frontend

Navigate to the frontend directory:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The frontend will be available at:

```text
http://localhost:5173
```

### Backend

Open another terminal and navigate to the backend:

```bash
cd backend
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The backend will run on:

```text
http://localhost:5000
```

## Backend Health Check

The backend provides a health-check endpoint:

```text
GET /api/health
```

Expected response:

```json
{
  "status": "ok",
  "message": "Hiring Pipeline API is running"
}
```

## Documentation

Detailed project documentation is available in the `docs` directory.

| Document | Purpose |
|---|---|
| `architecture.md` | System architecture and components |
| `schema.md` | Planned database schema |
| `decisions.md` | Technical decisions and their reasoning |
| `plan.md` | Development roadmap |
| `ai-prompts.md` | AI-assisted development documentation |

## Development Roadmap

```text
Phase 1
Project Setup
    |
    v
Phase 2
Architecture & Backend Foundation
    |
    v
Phase 3
Database & API Development
    |
    v
Phase 4
Frontend Development
    |
    v
Phase 5
Authentication & Authorization
    |
    v
Phase 6
Integration
    |
    v
Phase 7
Testing
    |
    v
Phase 8
Deployment
```

## Current Features

The current implementation includes:

- React frontend setup
- TypeScript configuration
- Vite development environment
- Node.js backend
- Express server
- CORS configuration
- Environment variable configuration
- Backend health-check API
- Project architecture documentation

## Planned Features

Future development will include:

- PostgreSQL database
- Prisma ORM
- User authentication
- Role-based authorization
- Job management
- Candidate management
- Application tracking
- Interview scheduling
- Interview feedback
- Recruitment pipeline
- Dashboard
- Search and filtering
- Notifications
- AI-assisted recruitment features

## Development Guidelines

- Keep frontend and backend responsibilities separate.
- Use TypeScript consistently.
- Keep sensitive configuration in environment variables.
- Do not commit `.env` files.
- Test changes before committing them.
- Keep documentation synchronized with implementation.
- Review AI-generated code before using it.

## License

This project is currently developed as an academic/project implementation.