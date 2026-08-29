# Hiring Pipeline — Technical Decisions

## 1. Overview

This document records the major technical decisions made during the development of the Hiring Pipeline application.

The purpose of this document is to explain why specific technologies and architectural approaches were selected.

---

## 2. Frontend Technology

### Decision

Use **React with TypeScript and Vite** for the frontend.

### Reason

React provides a component-based approach for building the user interface.

TypeScript provides static type checking and helps reduce errors during development.

Vite provides a fast development environment and build system for the React application.

### Selected Stack

```text
React
   |
TypeScript
   |
Vite
   |
CSS
```

---

## 3. Backend Technology

### Decision

Use **Node.js, Express.js, and TypeScript** for the backend.

### Reason

Node.js provides a JavaScript runtime for server-side development.

Express.js provides a lightweight framework for creating REST APIs.

TypeScript provides type safety and improves maintainability of the backend code.

### Selected Stack

```text
Node.js
   |
Express.js
   |
TypeScript
```

---

## 4. REST API Architecture

### Decision

Use REST APIs for communication between the frontend and backend.

### Reason

A REST-based architecture provides a clear separation between the frontend and backend.

It allows the frontend and backend to be developed and tested independently.

### Communication

```text
React Frontend
      |
      | HTTP / JSON
      v
Express REST API
      |
      v
Backend Logic
      |
      v
Database
```

---

## 5. Database Technology

### Decision

Use **PostgreSQL** as the planned relational database.

### Reason

The Hiring Pipeline application contains structured and related data such as:

- Users
- Jobs
- Candidates
- Applications
- Interviews
- Feedback

A relational database is suitable for representing these relationships and maintaining data consistency.

### Current Status

PostgreSQL has been selected as the planned database technology but has not yet been implemented.

---

## 6. ORM Technology

### Decision

Use **Prisma ORM** for database access.

### Reason

Prisma provides a type-safe interface for interacting with the PostgreSQL database.

It will also help manage database models and migrations.

### Current Status

Prisma is planned for the database implementation phase.

---

## 7. TypeScript

### Decision

Use TypeScript across the frontend and backend.

### Reason

TypeScript provides:

- Static type checking
- Better code maintainability
- Improved developer tooling
- Better IDE support
- Reduced runtime errors caused by incorrect data types

Using TypeScript consistently across the application also makes it easier to maintain shared data structures and API contracts.

---

## 8. Environment Configuration

### Decision

Use environment variables for configuration values.

The backend uses `dotenv` to load environment variables.

### Reason

Environment variables allow configuration to be separated from application source code.

This is useful for:

- Server ports
- Database connection strings
- Authentication secrets
- API keys
- Production configuration

Sensitive values should not be stored directly in source code or committed to GitHub.

---

## 9. CORS

### Decision

Use the CORS middleware in the backend.

### Reason

The frontend and backend run as separate applications during development.

CORS allows the backend to control which frontend origins can make requests to the API.

### Current Status

CORS has been configured in the backend.

---

## 10. Authentication Approach

### Decision

Implement authentication in a later development phase.

### Planned Approach

The application will use secure authentication mechanisms and token-based authentication.

### Reason

The application will have different types of users, such as:

- Recruiters
- Interviewers

Authentication will be required to identify users before implementing role-based access control.

### Current Status

Authentication has not yet been implemented.

---

## 11. Authorization and Roles

### Decision

Use role-based authorization.

### Planned Roles

```text
Recruiter
Interviewer
```

### Reason

Different users will require different permissions.

For example:

```text
Recruiter
   |
   +--> Manage Jobs
   +--> Manage Candidates
   +--> Manage Applications
   +--> Manage Pipeline


Interviewer
   |
   +--> View Assigned Interviews
   +--> View Candidates
   +--> Submit Feedback
```

### Current Status

Role-based authorization is planned but has not yet been implemented.

---

## 12. Git and GitHub

### Decision

Use Git for version control and GitHub for remote repository hosting.

### Reason

Git provides:

- Version history
- Change tracking
- Branching
- Collaboration
- Ability to revert changes

GitHub provides remote repository hosting and project collaboration features.

---

## 13. Project Structure

### Decision

Separate the application into frontend, backend, and documentation directories.

```text
hiring-pipeline/
|
+-- frontend/
|
+-- backend/
|
+-- docs/
|
+-- README.md
+-- .gitignore
+-- .env.example
```

### Reason

Separating the frontend and backend makes the project easier to:

- Develop
- Test
- Maintain
- Deploy
- Scale

Documentation is kept separately so that architecture and development decisions remain organized.

---

## 14. Database Access

### Decision

The frontend will not communicate directly with the database.

The backend will act as the intermediary between the frontend and database.

### Architecture

```text
Frontend
   |
   | REST API
   v
Backend
   |
   | Prisma
   v
PostgreSQL
```

### Reason

This approach provides:

- Better security
- Centralized business logic
- Controlled database access
- API-based separation of responsibilities

---

## 15. Development Approach

### Decision

Develop the application incrementally in phases.

### Planned Development Flow

```text
Project Setup
      |
      v
Backend Foundation
      |
      v
Database Integration
      |
      v
API Development
      |
      v
Frontend Development
      |
      v
Frontend-Backend Integration
      |
      v
Testing
      |
      v
Deployment
```

### Reason

A phased approach allows each major component to be developed and tested before moving to the next stage.

---

## 16. Current Architecture Decisions

The current major technology decisions are summarized below:

| Area | Technology / Approach | Status |
|---|---|---|
| Frontend | React | Implemented |
| Frontend Language | TypeScript | Implemented |
| Frontend Build Tool | Vite | Implemented |
| Backend Runtime | Node.js | Implemented |
| Backend Framework | Express.js | Implemented |
| Backend Language | TypeScript | Implemented |
| API | REST | Implemented |
| CORS | Express CORS middleware | Implemented |
| Environment Config | dotenv | Implemented |
| Database | PostgreSQL | Planned |
| ORM | Prisma | Planned |
| Authentication | Token-based | Planned |
| Authorization | Role-based | Planned |
| Deployment | Separate frontend/backend/database | Planned |

---

## 17. Decision Review

Technical decisions may be reviewed and updated as the application evolves.

Any significant change to the technology stack or architecture should be documented in this file along with the reason for the change.