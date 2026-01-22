# Backend (Domain & Business Logic)

## Purpose
Core domain logic, business rules, and workflow enforcement.
This is the heart of the application's intelligence.

## What This Folder MUST Contain
- Domain services for each entity (inspections, samples, jurisdictions)
- Workflow state machines
- Business rule enforcement
- Legal compliance logic

## What This Folder MUST NOT Contain
- HTTP routing or controllers
- Database queries (use repositories)
- UI logic
- Authentication middleware

## Structure
```
backend/
├── inspections/         # Inspection domain logic
│   └── inspection.service.ts
├── samples/             # Sample domain logic
│   └── sample.service.ts
├── jurisdictions/       # Jurisdiction domain logic
│   └── jurisdiction.service.ts
├── officers/            # Officer domain logic
│   └── officer.service.ts
├── documents/           # Document generation
│   └── document.service.ts
├── workflows/           # Workflow state machines
│   └── workflow.engine.ts
└── services/            # Shared services
    └── index.ts
```

## Domain Rules
1. **Inspections**: Closed inspections are IMMUTABLE (court admissibility)
2. **Samples**: Dispatched samples are IMMUTABLE (chain-of-custody)
3. **Jurisdictions**: Data is jurisdiction-bound, not officer-bound
4. **Officers**: Roles and capacities are admin-configurable

## Notes
- All domain rules enforced here, not in API or UI
- Historical data must never be overwritten
- Append-only where legally required
