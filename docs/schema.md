# Hiring Pipeline — Database Schema

## 1. Overview

The Hiring Pipeline database will store and manage information related to jobs, candidates, applications, interviews, users, interview stages, and feedback.

The database will be implemented in a later development phase.

### Planned Technologies

- PostgreSQL
- Prisma ORM

## 2. Database Architecture

The planned database architecture is:

```text
                    Hiring Pipeline
                          |
                          v
                    Express API
                          |
                          v
                     Prisma ORM
                          |
                          v
                  PostgreSQL Database
```

The backend will be responsible for communicating with the database.

The frontend will not communicate directly with the database.

## 3. Main Entities

The initial database design will contain the following entities:

- User
- Job
- Candidate
- Application
- Interview
- InterviewStage
- Feedback

## 4. Entity Relationship Overview

The planned relationships between the main entities are:

```text
User
 |
 +--------------------+
 |                    |
 v                    v
Job                Interview
 |                    |
 v                    v
Application        Feedback
 |
 v
Candidate
```

An application connects a candidate with a job.

An interview is associated with an application and can be assigned to an interviewer.

Feedback is associated with an interview.

## 5. User Entity

The `User` entity represents people who use the Hiring Pipeline application.

### Planned Fields

| Field | Type | Description |
|---|---|---|
| id | UUID | Unique user identifier |
| name | String | User's name |
| email | String | User's email address |
| passwordHash | String | Hashed password |
| role | Enum | User role |
| createdAt | DateTime | Account creation time |
| updatedAt | DateTime | Last update time |

### Planned Roles

```text
RECRUITER
INTERVIEWER
```

## 6. Job Entity

The `Job` entity represents a job opening created by a recruiter.

### Planned Fields

| Field | Type | Description |
|---|---|---|
| id | UUID | Unique job identifier |
| title | String | Job title |
| description | String | Job description |
| department | String | Department or team |
| location | String | Job location |
| status | Enum | Job status |
| createdById | UUID | Recruiter who created the job |
| createdAt | DateTime | Job creation time |
| updatedAt | DateTime | Last update time |

### Planned Job Status

```text
OPEN
CLOSED
DRAFT
```

## 7. Candidate Entity

The `Candidate` entity represents a person applying for a job.

### Planned Fields

| Field | Type | Description |
|---|---|---|
| id | UUID | Unique candidate identifier |
| name | String | Candidate's name |
| email | String | Candidate's email address |
| phone | String | Candidate's contact number |
| resumeUrl | String | Link to candidate resume |
| createdAt | DateTime | Candidate creation time |
| updatedAt | DateTime | Last update time |

## 8. Application Entity

The `Application` entity connects a candidate to a job.

A candidate can apply to multiple jobs, and a job can have multiple candidates.

### Planned Fields

| Field | Type | Description |
|---|---|---|
| id | UUID | Unique application identifier |
| candidateId | UUID | Associated candidate |
| jobId | UUID | Associated job |
| status | Enum | Current application status |
| appliedAt | DateTime | Application creation time |
| updatedAt | DateTime | Last update time |

### Planned Application Status

```text
APPLIED
SCREENING
SHORTLISTED
INTERVIEW
SELECTED
REJECTED
HIRED
```

## 9. InterviewStage Entity

The `InterviewStage` entity represents a stage in the recruitment process.

### Planned Fields

| Field | Type | Description |
|---|---|---|
| id | UUID | Unique stage identifier |
| name | String | Stage name |
| order | Integer | Stage order |
| description | String | Stage description |

### Example Stages

```text
Screening
Technical Interview
HR Interview
Final Interview
```

## 10. Interview Entity

The `Interview` entity represents a scheduled interview for an application.

### Planned Fields

| Field | Type | Description |
|---|---|---|
| id | UUID | Unique interview identifier |
| applicationId | UUID | Associated application |
| interviewerId | UUID | Assigned interviewer |
| stageId | UUID | Interview stage |
| scheduledAt | DateTime | Interview date and time |
| status | Enum | Interview status |
| createdAt | DateTime | Interview creation time |
| updatedAt | DateTime | Last update time |

### Planned Interview Status

```text
SCHEDULED
COMPLETED
CANCELLED
RESCHEDULED
```

## 11. Feedback Entity

The `Feedback` entity stores feedback submitted by an interviewer after an interview.

### Planned Fields

| Field | Type | Description |
|---|---|---|
| id | UUID | Unique feedback identifier |
| interviewId | UUID | Associated interview |
| interviewerId | UUID | User providing feedback |
| rating | Integer | Interview rating |
| comments | String | Detailed feedback |
| recommendation | Enum | Interview recommendation |
| createdAt | DateTime | Feedback creation time |
| updatedAt | DateTime | Last update time |

### Planned Recommendations

```text
STRONG_HIRE
HIRE
NO_HIRE
STRONG_NO_HIRE
```

## 12. Entity Relationships

The planned relationships are:

### User → Job

A recruiter can create multiple jobs.

```text
User (Recruiter)
      |
      | 1 : N
      v
     Job
```

### Job → Application

A job can receive multiple applications.

```text
Job
 |
 | 1 : N
 v
Application
```

### Candidate → Application

A candidate can have multiple applications.

```text
Candidate
    |
    | 1 : N
    v
Application
```

### Application → Interview

An application can have multiple interviews.

```text
Application
     |
     | 1 : N
     v
  Interview
```

### Interviewer → Interview

An interviewer can be assigned multiple interviews.

```text
User (Interviewer)
       |
       | 1 : N
       v
    Interview
```

### Interview → Feedback

An interview can have feedback submitted by the interviewer.

```text
Interview
    |
    | 1 : 1
    v
 Feedback
```

### InterviewStage → Interview

A stage can contain multiple interviews.

```text
InterviewStage
      |
      | 1 : N
      v
   Interview
```

## 13. Complete Relationship Diagram

```text
                         User
                       /      \
                      /        \
             creates /          \ assigned
                    v            v
                  Job          Interview
                   |               |
                   |               |
                   v               v
             Application       Feedback
              /       \
             /         \
            v           v
       Candidate      Interview
                         |
                         v
                  InterviewStage
```

## 14. Database Constraints

The following constraints are planned:

- Every user will have a unique email address.
- Every candidate will have a unique email address.
- Every application will reference a valid candidate.
- Every application will reference a valid job.
- Every interview will reference a valid application.
- Every interview will reference an interviewer.
- Every interview will reference an interview stage.
- Every feedback record will reference a valid interview.
- Required fields will not allow null values.
- Foreign key relationships will maintain referential integrity.

## 15. Indexing Strategy

Indexes will be added to frequently queried fields.

The planned indexes include:

- `User.email`
- `Candidate.email`
- `Application.jobId`
- `Application.candidateId`
- `Interview.applicationId`
- `Interview.interviewerId`
- `Interview.scheduledAt`

Indexes will be finalized during database implementation based on actual query patterns.

## 16. Data Flow

The planned data flow is:

```text
React Frontend
      |
      | REST API
      v
Express Backend
      |
      v
Business Logic
      |
      v
Prisma ORM
      |
      v
PostgreSQL
      |
      v
Prisma ORM
      |
      v
Express Backend
      |
      | JSON Response
      v
React Frontend
```

## 17. Current Status

### Completed

- Initial database entities identified
- Entity relationships planned
- Application workflow identified
- Initial database architecture documented

### Planned

- PostgreSQL setup
- Prisma installation
- Prisma schema implementation
- Database migrations
- Seed data
- Database connection
- CRUD APIs
- Database validation
- Production database configuration

The schema will be updated when the database implementation begins.