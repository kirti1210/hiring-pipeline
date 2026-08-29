# Hiring Pipeline — Architecture

## 1. Project Overview

Hiring Pipeline is a web-based recruitment management application designed to help recruiters and interviewers manage jobs, candidates, interview stages, feedback, and recruitment workflow.

The project is divided into a frontend and backend application.

## 2. High-Level Architecture

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
                     Database
                  (planned/next phase)
```

## 3. Frontend Architecture

The frontend provides the user interface for recruiters and interviewers.

### Technologies

- React
- TypeScript
- Vite
- CSS

### Responsibilities

The frontend will handle:

- User interface and navigation
- Job and candidate management
- Candidate profile display
- Interview stage tracking
- Interview scheduling
- Interview feedback forms
- Recruitment pipeline visualization
- Communication with backend APIs

### Frontend Flow

```text
User
  |
  v
React UI
  |
  v
Frontend Components
  |
  v
API Requests
  |
  v
Backend REST API
```

## 4. Backend Architecture

The backend provides the REST API and handles the application's business logic.

### Technologies

- Node.js
- Express.js
- TypeScript
- CORS
- dotenv

### Responsibilities

The backend will handle:

- REST API development
- Request and response handling
- Job and candidate data management
- Interview stage management
- Feedback management
- Validation and business logic
- Communication with the database
- Environment configuration

### Backend Flow

```text
Frontend
   |
   | HTTP Request
   v
Express REST API
   |
   v
Route Handlers
   |
   v
Business Logic
   |
   v
Database
```

### Current Backend API

The backend currently provides a health-check endpoint:

```text
GET /api/health
```

Example response:

```json
{
  "status": "ok",
  "message": "Hiring Pipeline API is running"
}
```

## 5. API Communication

The frontend and backend communicate through REST APIs using HTTP requests.

### Communication Flow

```text
User Action
    |
    v
React Frontend
    |
    | HTTP Request
    v
Express Backend
    |
    | Process Request
    v
Business Logic
    |
    v
Database
    |
    | Response
    v
Express Backend
    |
    | JSON Response
    v
React Frontend
    |
    v
Updated UI
```

### Planned API Areas

The backend will provide APIs for:

- Jobs
- Candidates
- Applications
- Interviews
- Interview stages
- Feedback
- Users

## 6. Database Layer

The database layer will store and manage the application's persistent recruitment data.

The database will be introduced in a later development phase.

### Planned Database Technology

- PostgreSQL
- Prisma ORM

### Planned Data

The database will store information related to:

- Users
- Jobs
- Candidates
- Applications
- Interviews
- Interview stages
- Interview feedback
- Candidate history

### Planned Database Flow

```text
Express Backend
       |
       v
Business Logic
       |
       v
Prisma ORM
       |
       v
PostgreSQL Database
```

The detailed database design will be documented in:

```text
docs/schema.md
```

## 7. Authentication and Authorization

Authentication and authorization will be implemented in a later development phase.

### Authentication

Authentication will verify the identity of users accessing the application.

The planned authentication flow is:

```text
User
  |
  v
Login Form
  |
  v
Backend Authentication API
  |
  v
Credential Validation
  |
  v
Authentication Token
  |
  v
Authenticated User
```

### Authorization

Authorization will determine what actions a user is allowed to perform.

The initial planned roles are:

- Recruiter
- Interviewer

### Planned Role Responsibilities

```text
Recruiter
   |
   +--> Manage Jobs
   +--> Manage Candidates
   +--> Manage Applications
   +--> Manage Recruitment Pipeline


Interviewer
   |
   +--> View Assigned Interviews
   +--> View Candidate Information
   +--> Submit Interview Feedback
```

Authorization rules will be enforced by the backend.

### Current Status

Authentication and authorization are not yet implemented.

They will be added during a later development phase.

## 8. Project Structure

The project is organized into separate frontend, backend, and documentation directories.

```text
hiring-pipeline/
|
+-- frontend/
|   +-- src/
|   |   +-- assets/
|   |   +-- App.tsx
|   |   +-- App.css
|   |   +-- main.tsx
|   |   +-- index.css
|   |
|   +-- public/
|   +-- package.json
|   +-- tsconfig.json
|   +-- vite.config.ts
|
+-- backend/
|   +-- src/
|   |   +-- server.ts
|   |
|   +-- package.json
|   +-- package-lock.json
|   +-- tsconfig.json
|
+-- docs/
|   +-- architecture.md
|   +-- schema.md
|   +-- plan.md
|   +-- decisions.md
|   +-- ai-prompts.md
|
+-- .env.example
+-- .gitignore
+-- README.md
+-- SUBMISSION.md
```

## 9. Environment Configuration

Environment-specific configuration is managed using environment variables.

An example configuration file is provided in:

```text
.env.example
```

The current example configuration contains:

```env
PORT=5000
```

The actual `.env` file should not be committed to GitHub.

Environment variables allow different configurations to be used during development, testing, and production without changing the source code.

## 10. Development and Local Setup

The frontend and backend are developed and run as separate applications during local development.

### Frontend Setup

The frontend is based on React, TypeScript, and Vite.

The frontend development server runs on:

```text
http://localhost:5173
```

### Backend Setup

The backend is based on Node.js, Express, and TypeScript.

The backend development server runs on:

```text
http://localhost:5000
```

The backend development server can be started using:

```bash
npm run dev
```

### Backend Health Check

Once the backend is running, it can be verified using:

```text
GET http://localhost:5000/api/health
```

Expected response:

```json
{
  "status": "ok",
  "message": "Hiring Pipeline API is running"
}
```

### Local Development Flow

```text
Developer
    |
    +--------------------+
    |                    |
    v                    v
Frontend Server      Backend Server
localhost:5173       localhost:5000
    |                    |
    +------ REST API ----+
```

## 11. Deployment Architecture

Production deployment has not yet been implemented.

The planned production architecture will separate the frontend, backend, and database services.

### Planned Deployment Flow

```text
User Browser
     |
     v
Frontend Hosting
     |
     | HTTPS API Requests
     v
Backend Hosting
     |
     v
PostgreSQL Database
```

Deployment configuration and production URLs will be documented after deployment is implemented.

### Current Status

Deployment is currently planned and has not yet been implemented.

## 12. Security Considerations

Security will be considered throughout the development of the Hiring Pipeline application.

### Planned Security Measures

The application will include the following security measures as the relevant features are implemented:

- Passwords will be securely hashed before being stored.
- Authentication will use secure authentication mechanisms.
- Authorization will be enforced on the backend.
- Sensitive configuration values will be stored using environment variables.
- `.env` files containing sensitive information will not be committed to GitHub.
- API inputs will be validated before processing.
- Database access will be controlled through the backend.
- CORS will be configured appropriately.
- Production communication will use HTTPS.

### Current Status

The initial project setup includes CORS configuration, environment variable support, and Git configuration for excluding sensitive local files.

Authentication, authorization, database security, and production security measures will be implemented in later development phases.

## 13. Current Implementation Status

The following components have been completed as part of the initial project setup.

### Implemented

- GitHub repository created
- Project repository cloned locally
- React frontend initialized
- TypeScript configured for the frontend
- Vite configured for frontend development
- Node.js backend initialized
- Express server configured
- TypeScript configured for the backend
- CORS configured
- dotenv configured for environment variables
- `.env.example` created
- Backend development script configured
- Backend health-check endpoint implemented
- Frontend and backend project structure established
- Initial architecture documentation created
- Git version control configured
- GitHub remote repository configured

### Planned / Not Yet Implemented

The following features are planned for subsequent development phases:

- PostgreSQL database
- Prisma ORM
- Database schema implementation
- Database migrations
- Authentication
- Authorization
- User roles
- Job management APIs
- Candidate management APIs
- Application management APIs
- Interview management APIs
- Interview feedback APIs
- Recruitment pipeline logic
- Search and filtering
- Dashboard
- Notifications
- AI-assisted recruitment features
- Production deployment

The architecture document will be updated as new components and features are implemented.