# Data Access Layer

## Layer: DATA / REPOSITORIES (Layer 2C)

This directory contains all data access logic using the Repository pattern.

---

## Purpose

The data layer provides a clean abstraction over database operations.
Domain services use repositories to access data without knowing database details.

---

## Structure

```
data/
├── repositories/
│   ├── index.ts                  # Central exports
│   ├── inspection.repository.ts  # Inspection data access
│   ├── sample.repository.ts      # Sample data access
│   └── officer.repository.ts     # Officer data access
└── README.md
```

---

## Responsibilities

### MUST DO:
- Execute database queries
- Provide typed data access methods
- Handle query construction and parameters
- Map database results to typed objects
- Handle database errors gracefully

### MUST NOT DO:
- Contain business logic or rules
- Make workflow decisions
- Validate business constraints (domain layer does this)
- Execute HTTP operations

---

## Usage Pattern

```typescript
import { inspectionRepository } from "@/data/repositories";

// Domain service uses repository
async function getInspection(id: string) {
  const inspection = await inspectionRepository.findById(id);
  
  // Domain service applies business rules
  if (inspection.status === "closed") {
    return { success: false, error: "Cannot modify closed inspection" };
  }
  
  return { success: true, data: inspection };
}
```

---

## Repository Methods Convention

```typescript
// Standard repository interface
interface Repository<T, ID> {
  findById(id: ID): Promise<T | null>;
  findAll(options?: FilterOptions): Promise<T[]>;
  create(data: NewT): Promise<T>;
  update(id: ID, data: Partial<T>): Promise<T>;
  delete(id: ID): Promise<boolean>;
}
```

---

## File Header Template

```typescript
/**
 * =============================================================================
 * FILE: server/data/repositories/[entity].repository.ts
 * LAYER: DATA ACCESS (Layer 3)
 * =============================================================================
 * 
 * PURPOSE:
 * Provides data access methods for [entity] records.
 * 
 * WHAT THIS FILE MUST DO:
 * - Execute database queries
 * - Return typed results
 * 
 * WHAT THIS FILE MUST NOT DO:
 * - Contain business logic
 * - Make workflow decisions
 * - Validate business rules
 * 
 * DEPENDENT SYSTEMS:
 * - server/domain/[entity]/[entity].service.ts uses this repository
 * =============================================================================
 */
```
