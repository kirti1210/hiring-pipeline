# Hiring Pipeline — Submission

## 1. Project Overview

Hiring Pipeline is a full-stack recruitment management application designed to manage jobs, candidates, applications, interviews, hiring stages, feedback, rejection/reinstatement, alerts, and application history.

The application provides separate workflows for recruiters and interviewers, with role-based access control and an immutable application history.

---

## 2. Live Demo

**Live Application:**
https://hiring-pipeline-frontend.onrender.com

**Backend API:**
https://hiring-pipeline-aatl.onrender.com

**API Health Check:**
https://hiring-pipeline-aatl.onrender.com/api/health

The live application is deployed using Render.

---

## 3. Demo Credentials

### Recruiter

Email:
`demo.recruiter@hiringpage.com`

Password:
`<YOUR_DEMO_RECRUITER_PASSWORD>`

### Interviewer

Email:
`demo.interviewer1@hiringpage.com`

Password:
`<YOUR_DEMO_INTERVIEWER_PASSWORD>`

> Replace the password placeholders above with the actual demo passwords before submission.
> Do not include production secrets such as `DATABASE_URL` or `JWT_SECRET`.

---

## 4. Key Features

### Authentication & Authorization

- User registration and login
- JWT-based authentication
- Password hashing using bcrypt
- Role-based authorization
- Recruiter and interviewer workflows

### Job Management

- Create jobs
- Edit jobs
- View job details
- Archive jobs
- Restore archived jobs
- Track application counts

### Candidate & Application Management

- Candidate listing
- Candidate search
- Filter applications by:
  - Stage
  - Source
  - Job
  - Candidate
- Pagination
- Sorting
- Candidate detail view
- Application detail view

### Hiring Pipeline

Applications move through the following stages:

`APPLIED → SCREENING → INTERVIEW → OFFER → HIRED`

Invalid stage transitions are rejected.

Rejected and withdrawn applications are handled separately.

### Rejection & Reinstatement

- Reject candidates from active pipeline stages
- Store the stage from which the candidate was rejected
- Reinstate candidates to their exact previous stage
- Preserve rejection and reinstatement history

### Interviewer Workflow

- Recruiters can assign multiple interviewers
- Interviewers can view assigned candidates
- Interviewers can submit feedback
- Feedback is immutable after submission
- Interviewer assignment and feedback actions are recorded in history

### Application History

Every important application action is recorded as an immutable event, including:

- Application creation
- Stage changes
- Notes
- Rejection
- Reinstatement
- Interviewer assignment
- Interviewer removal
- Interview feedback

### Dashboard

The dashboard provides:

- Open Jobs
- Total Applications
- Interviews This Week
- Hires This Month
- Applications by Job
- Applications by Stage
- Weekly application trends

### Stalled Application Alerts

Applications that remain in the same active stage for more than 10 days are flagged.

Recruiters can:

- View stalled applications
- View stalled count
- Dismiss an alert
- Receive a new alert when an application enters another stalled stage

### Bulk Actions

Recruiters can:

- Select multiple applications
- Advance multiple applications
- Reject multiple applications
- Continue processing valid records when some selected records fail validation

### CSV Export

Application data can be exported as CSV using the current filtering and sorting criteria.

---

## 5. Technology Stack

### Frontend

- React
- TypeScript
- Vite
- React Router
- CSS

### Backend

- Node.js
- Express
- TypeScript
- JWT
- bcrypt
- CORS

### Database

- PostgreSQL
- Supabase

### ORM

- Prisma

### Deployment

- Render Static Site — Frontend
- Render Web Service — Backend
- Supabase — PostgreSQL Database

### Version Control

- Git
- GitHub

---

## 6. Architecture

```text
                         ┌─────────────────────┐
                         │      User           │
                         └──────────┬──────────┘
                                    │
                                    ▼
                    ┌───────────────────────────┐
                    │ React + TypeScript        │
                    │ Render Static Site        │
                    └─────────────┬─────────────┘
                                  │
                              REST API
                                  │
                                  ▼
                    ┌───────────────────────────┐
                    │ Express + TypeScript      │
                    │ Render Web Service        │
                    └─────────────┬─────────────┘
                                  │
                                Prisma
                                  │
                                  ▼
                    ┌───────────────────────────┐
                    │ PostgreSQL / Supabase      │
                    └───────────────────────────┘
