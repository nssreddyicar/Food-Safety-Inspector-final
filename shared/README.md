# Shared Layer

## Layer: CONTRACTS & TYPES (Layer 3)

This directory contains all shared type definitions, database schema, and constants.
It is the **single source of truth** for data structures and contracts.

---

## Purpose

The shared layer defines all data contracts used across the system.
All other layers import from here to ensure consistency.

**CRITICAL**: Changes here affect ALL layers. Update explicitly in each consuming layer.

---

## What This Folder MUST Contain
- TypeScript interfaces and types
- Enums for domain values
- Database schema (Drizzle ORM)
- Constants and configuration
- Validation schemas (Zod)

## What This Folder MUST NOT Contain
- Business logic
- Side effects
- Database operations
- HTTP handling
- Runtime dependencies

---

## Structure

```
shared/
├── schema.ts            # Drizzle ORM database schema
├── index.ts             # Central exports
├── types/               # TypeScript interfaces
│   ├── index.ts
│   ├── officer.types.ts
│   ├── inspection.types.ts
│   ├── sample.types.ts
│   └── jurisdiction.types.ts
├── enums/               # Domain enums
│   ├── status.enums.ts
│   └── index.ts
└── README.md
```

---

## Usage

```typescript
// Import from shared
import { Officer, InspectionStatus } from '@shared/types';
import { SAMPLE_STATUSES } from '@shared/enums';
```

---

## Making Schema Changes Safely

When modifying the database schema:

1. **Check current schema first** - Look at existing database structure
2. **Match existing ID types** - Never change serial ↔ varchar
3. **Add new fields as nullable** when possible
4. **Run migration**: `npm run db:push`

**NEVER**:
- Change primary key column types
- Remove columns with existing data
- Rename columns (add new, migrate, remove old)

---

## Cross-Layer Update Checklist

When adding a new field or type:

| Layer | File(s) to Update | Purpose |
|-------|-------------------|---------|
| Shared | `schema.ts`, `types/*.ts` | Define structure |
| Data | `repositories/*.ts` | Update queries |
| Domain | `domain/*.ts` | Add validation if needed |
| Server | `routes.ts` | Expose in API if needed |
| Frontend | `types/index.ts` | Match API response |

**Each update must be explicit** - there is no automatic propagation.

---

## Type Definition Conventions

```typescript
// Use domain language, not technical jargon
interface Inspection {
  id: number;
  jurisdictionId: string;        // UUID reference
  status: InspectionStatus;      // Type-safe enum
  createdAt: Date;
  updatedAt: Date;
}

// Use const assertions for enums
export const INSPECTION_STATUS = {
  DRAFT: "draft",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CLOSED: "closed",
} as const;

export type InspectionStatus = typeof INSPECTION_STATUS[keyof typeof INSPECTION_STATUS];
```

---

## Notes
- Use domain language only
- No abbreviations without explanation
- All types must be documented
- Changes here require updates in ALL consuming layers
