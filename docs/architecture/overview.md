# Architecture Overview

## System Components

```
┌─────────────────┐     ┌─────────────────┐
│   Android App   │     │    Web App      │
│   (Flutter)     │     │    (React)      │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │ HTTP/REST
                     ▼
         ┌─────────────────────┐
         │   Server (API)      │
         │   - Routes          │
         │   - Controllers     │
         │   - Middleware      │
         │   - Auth            │
         └──────────┬──────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │   Backend (Domain)  │
         │   - Services        │
         │   - Workflows       │
         │   - Business Rules  │
         └──────────┬──────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │   Database (Data)   │
         │   - Repositories    │
         │   - Schema          │
         │   - Migrations      │
         └──────────┬──────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │   PostgreSQL        │
         └─────────────────────┘
```

## Layer Responsibilities

### 1. Clients (Android App / Web App)
- User interface rendering
- User input handling
- API communication
- Local caching

### 2. Server (API Layer)
- HTTP request handling
- Authentication (JWT)
- Authorization (role-based)
- Request validation
- Response formatting

### 3. Backend (Domain Layer)
- Business logic
- Workflow state machines
- Rule enforcement
- Domain events

### 4. Database (Data Layer)
- Data persistence
- Repository pattern
- Query optimization
- Audit logging

## Data Flow Example: Create Inspection

```
1. Officer opens "New Inspection" in Android App
2. App sends POST /api/inspections to Server
3. Server validates request and checks authorization
4. Server calls InspectionService.create()
5. InspectionService applies business rules
6. InspectionService calls InspectionRepository.create()
7. Repository inserts record into PostgreSQL
8. Response flows back through layers
9. App displays success message
```

## Security Model

1. **Authentication**: JWT tokens with expiration
2. **Authorization**: Role-based access control (RBAC)
3. **Jurisdiction**: Data access limited to assigned jurisdictions
4. **Audit**: All modifications logged with officer ID and timestamp

## Deployment Architecture

```
┌─────────────────────────────────────────────────┐
│                   Load Balancer                 │
└─────────────────────┬───────────────────────────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│  Server Node 1  │     │  Server Node 2  │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     ▼
         ┌─────────────────────┐
         │   PostgreSQL        │
         │   (Primary + Read   │
         │    Replicas)        │
         └─────────────────────┘
```
