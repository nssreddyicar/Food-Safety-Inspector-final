# Documentation

## Purpose
Architecture documentation, workflow diagrams, API documentation,
and legal/audit notes for the Food Safety Inspector system.

## Quick Links
- [Architecture Guidelines](ARCHITECTURE.md) - Core architectural principles
- [Inspection Workflow](workflows/inspection-workflow.md) - FBO inspection process
- [Sample Workflow](workflows/sample-workflow.md) - Sample collection & testing

## What This Folder MUST Contain
- Architecture diagrams
- Workflow documentation
- API documentation
- Legal compliance notes
- Onboarding guides

## Structure
```
docs/
├── ARCHITECTURE.md          # Core architecture guidelines
├── README.md                # This file
├── architecture/            # System architecture
│   └── overview.md
├── workflows/               # Business workflows
│   ├── inspection-workflow.md
│   └── sample-workflow.md
├── api/                     # API documentation (future)
│   ├── endpoints.md
│   └── authentication.md
├── legal/                   # Legal & compliance (future)
│   ├── data-retention.md
│   ├── audit-requirements.md
│   └── court-admissibility.md
└── onboarding/              # Developer guides (future)
    ├── getting-started.md
    └── contribution-guide.md
```

## System Overview

### Core Modules

| Module | Description | Status |
|--------|-------------|--------|
| FBO Inspections | Food Business Operator inspections | Complete |
| Institutional Inspections | School/hostel FSSAI assessments | Complete |
| Sample Management | Lab sample tracking | Complete |
| Complaint Management | Public complaint system | Complete |
| Court Cases | Prosecution management | Complete |
| Admin Panels | Configuration management | Complete |

### App Architecture
- **Flutter** (`android-app/`) - Production app for Play Store
- **Expo** (`client/`) - Development/testing on Replit
- **Express.js** (`server/`) - Backend API
- **PostgreSQL** - Database with Drizzle ORM

### Key Features
1. **Government-Grade Security** - Immutable records for court admissibility
2. **FSSAI Compliance** - 7 pillars, 35 indicators for institutional inspections
3. **Anti-Fraud Watermarking** - GPS and timestamp baked into evidence photos
4. **Dynamic Forms** - Admin-configurable fields for all inspection types
5. **PDF Reports** - Professional reports with photo appendix
6. **Audit Trail** - All changes logged with officer ID and timestamp

## Key Documents
1. **[ARCHITECTURE.md](ARCHITECTURE.md)**: Layer structure, domain rules, change guidelines
2. **Workflow Documentation**: Business process flows for inspections and samples
3. **Legal Requirements**: Immutability rules, chain-of-custody, audit requirements

## API Endpoints Summary

### Public APIs (No Auth)
- `GET /api/complaints/form-config` - Complaint form configuration
- `POST /api/complaints/submit` - Submit complaint
- `GET /api/complaints/track/:code` - Track complaint status
- `GET /api/institutional-inspections/form-config` - Inspection form config

### Officer APIs
- `/api/inspections/*` - FBO inspection management
- `/api/institutional-inspections/*` - Institutional inspection management
- `/api/samples/*` - Sample tracking
- `/api/complaints/*` - Complaint handling
- `/api/court-cases/*` - Prosecution management

### Admin APIs
- `/api/admin/fbo-inspection/*` - FBO inspection configuration
- `/api/admin/institutional-inspection/*` - Institutional inspection configuration
- `/api/admin/complaints/*` - Complaint form configuration

## Notes
- Keep documentation up to date with code changes
- Use diagrams for complex concepts
- All domain rules are documented in ARCHITECTURE.md
- Assume another AI/developer will maintain this system
