# Database (Data Persistence)

## Purpose
Schema definitions, migrations, repositories, and data access.
Single source of truth for database operations.

## What This Folder MUST Contain
- Drizzle ORM schema definitions
- Repository pattern implementations
- Database migrations
- Seed data for development

## What This Folder MUST NOT Contain
- Business logic
- HTTP handling
- UI code
- Workflow rules

## Structure
```
database/
├── schema/              # Drizzle schema definitions
│   ├── officers.ts
│   ├── inspections.ts
│   ├── samples.ts
│   └── jurisdictions.ts
├── repositories/        # Data access layer
│   ├── officer.repository.ts
│   ├── inspection.repository.ts
│   ├── sample.repository.ts
│   └── jurisdiction.repository.ts
├── migrations/          # Database migrations
│   └── YYYYMMDD_description.sql
├── seeds/               # Development seed data
│   └── seed.ts
└── index.ts             # Database connection
```

## Data Integrity Rules
1. Historical data must NEVER be overwritten
2. Append-only for legally required audit trails
3. All operations are jurisdiction-aware
4. Soft delete preferred over hard delete

## Notes
- Use Drizzle ORM for type-safe queries
- All repositories follow consistent patterns
- Migrations are version controlled
