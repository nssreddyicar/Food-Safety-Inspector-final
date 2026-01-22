# Architecture Guidelines

## Government-Grade Regulatory System Architecture

This document defines the architectural principles for the Food Safety Inspector system.
All changes must follow these guidelines to maintain legal compliance, auditability, and system integrity.

---

## CORE ASSUMPTION (MANDATORY)

**DO NOT assume that editing one file automatically updates other files.**

All updates across frontend, backend, server, database, or shared models must be:
- **Intentional** - Every change is deliberate
- **Explicit** - No hidden side effects
- **Traceable** - Can be audited later
- **Layer-appropriate** - Respects boundaries

---

## Layer Structure

```
/
├── android-app/        # LAYER 1A: Flutter Frontend (Production)
├── client/             # LAYER 1B: Expo Frontend (Development)
├── web-app/            # LAYER 1C: React Admin Panel (Future)
│
├── server/             # LAYER 2: API & Orchestration
│   ├── routes.ts       # HTTP route definitions
│   ├── domain/         # Business logic services
│   ├── data/           # Repository pattern (data access)
│   ├── services/       # Infrastructure services
│   └── config/         # Server configuration
│
├── shared/             # LAYER 3: Contracts & Types
│   ├── schema.ts       # Database schema (Drizzle ORM)
│   ├── types/          # TypeScript interfaces
│   └── enums/          # Status values & constants
│
├── docs/               # Documentation
├── infra/              # Infrastructure & deployment
└── assets/             # Static assets
```

---

## Layer Responsibilities

### LAYER 1: Frontend (android-app/, client/, web-app/)

**PURPOSE**: User interface and presentation only.

**MUST DO**:
- Render UI based on backend state
- Collect user input and send to API
- Handle local UI state (loading, errors)
- Display validation errors from backend

**MUST NOT DO**:
- Enforce business rules (backend does this)
- Make decisions about workflow transitions
- Bypass backend validation
- Store sensitive data locally without encryption

**DEPENDENT ON**: Server API responses

---

### LAYER 2: Server (server/)

**PURPOSE**: API orchestration and business logic enforcement.

#### 2A: Routes (server/routes.ts)

**MUST DO**:
- Define HTTP endpoints
- Parse and validate request parameters
- Call domain services for business logic
- Return standardized responses

**MUST NOT DO**:
- Contain business logic (use domain services)
- Execute raw SQL (use repositories)
- Make workflow decisions (use domain services)

#### 2B: Domain Services (server/domain/)

**MUST DO**:
- Enforce ALL business and legal rules
- Validate workflow state transitions
- Check permissions and authorization
- Apply immutability rules

**MUST NOT DO**:
- Execute HTTP operations
- Render UI
- Access database directly (use repositories)

#### 2C: Data Repositories (server/data/repositories/)

**MUST DO**:
- Execute database operations
- Provide typed data access
- Handle query construction

**MUST NOT DO**:
- Contain business logic
- Make workflow decisions
- Validate business rules

---

### LAYER 3: Shared (shared/)

**PURPOSE**: Single source of truth for types and contracts.

**MUST DO**:
- Define database schema
- Define TypeScript interfaces
- Define enum values and constants
- Be consumed by all other layers

**MUST NOT DO**:
- Contain logic
- Import from other layers
- Have runtime dependencies

---

## Change Classification

Before making any change, classify it:

| Change Type | Impacted Layers |
|-------------|-----------------|
| UI / Presentation | Frontend only |
| Business / Legal Rules | Domain services first, then API |
| API Contract | Server routes + Shared types |
| Data Structure | Schema + Shared types + Repositories |
| Configuration | Infrastructure only |

---

## Domain Rules (IMMUTABLE)

These rules can NEVER be changed or bypassed:

### 1. Inspection Immutability
```
RULE: Closed inspections cannot be modified.
WHY: Court admissibility requires unaltered evidence.
ENFORCED IN: server/domain/inspection/inspection.service.ts
```

### 2. Sample Chain-of-Custody
```
RULE: Dispatched samples cannot be modified.
WHY: Legal chain-of-custody must be preserved.
ENFORCED IN: server/domain/sample/sample.service.ts
```

### 3. Jurisdiction Binding
```
RULE: Data belongs to jurisdictions, not officers.
WHY: Officer transfers must not affect data continuity.
ENFORCED IN: All domain services
```

### 4. Audit Trail Preservation
```
RULE: All modifications must be logged with officer ID and timestamp.
WHY: Legal requirement for accountability.
ENFORCED IN: All write operations
```

---

## Making Changes Safely

### Step 1: Understand Intent
Before changing any file, read:
- File header comments (PURPOSE, MUST DO, MUST NOT DO)
- Related documentation
- Dependent systems list

### Step 2: Classify Change
Determine which layers are impacted:
- UI only → Frontend
- Workflow/rules → Domain services
- API shape → Routes + Types
- Data structure → Schema + Repositories

### Step 3: Update Explicitly
For each impacted layer:
- Make changes in the correct files
- Add comments explaining WHY
- List affected workflows

### Step 4: Verify Consistency
Check that:
- Frontend reflects backend state (not rules)
- Backend enforces all legal rules
- Server APIs orchestrate (not decide)
- Database preserves history
- Shared types are up to date

---

## File Header Template

Every significant file must have this header:

```typescript
/**
 * =============================================================================
 * FILE: [path/to/file]
 * LAYER: [FRONTEND | SERVER | DOMAIN | DATA | SHARED]
 * =============================================================================
 * 
 * PURPOSE:
 * [What this file does and why it exists]
 * 
 * WHAT THIS FILE MUST DO:
 * - [Responsibility 1]
 * - [Responsibility 2]
 * 
 * WHAT THIS FILE MUST NOT DO:
 * - [Anti-pattern 1]
 * - [Anti-pattern 2]
 * 
 * DOMAIN RULES ENFORCED:
 * - [Rule 1 if applicable]
 * 
 * DEPENDENT SYSTEMS:
 * - [File/layer that depends on this]
 * =============================================================================
 */
```

---

## Anti-Patterns to Avoid

### 1. Hardcoded Workflows
```
WRONG: if (status === "completed") { nextStatus = "closed"; }
RIGHT: Check allowed transitions from database/config
```

### 2. Frontend Business Logic
```
WRONG: Frontend decides if user can close inspection
RIGHT: Frontend asks backend, backend enforces rules
```

### 3. Mixed Responsibilities
```
WRONG: Route handler contains 200 lines of validation
RIGHT: Route calls domain service, service validates
```

### 4. Direct Database Access from Routes
```
WRONG: app.get("/api/data", async () => { db.select()... })
RIGHT: Route calls repository, repository queries database
```

---

## For Future Maintainers

This system is designed to be:
- **Auditable** - Every change is traceable
- **Court-admissible** - Data integrity is preserved
- **Maintainable** - Clear layer boundaries
- **Extensible** - New features follow the same patterns

When in doubt, ask:
1. Which layer owns this responsibility?
2. What domain rules apply?
3. Who depends on this file?
4. Can this change break legal compliance?

---

## Version History

| Date | Change | Author |
|------|--------|--------|
| 2026-01-21 | Initial architecture documentation | System |
