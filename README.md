# Food Safety Inspector - Government-Grade Regulatory System

A production-grade system for Food Safety Officers (FSOs) to manage inspections,
sample collection, and prosecution workflows under FSSAI regulations.

## Architecture Overview

This project follows strict separation of concerns with independently deployable components:

```
/
├── android-app/        # Flutter Android app (Play Store ready)
├── web-app/            # Web Admin & Authority Panel (browser deployable)
├── backend/            # Business logic & domain services
├── server/             # API, routing, authentication
├── database/           # Schema, migrations, data access
├── shared/             # Shared domain models & types
├── infra/              # Deployment & infrastructure
├── docs/               # Architecture & workflow documentation
└── README.md           # This file
```

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Flutter SDK 3.10+ (for Android app)

### Development

```bash
# Install dependencies
npm install

# Setup database
npm run db:push

# Start development server
npm run dev
```

### Android App (Flutter)
```bash
cd android-app
flutter pub get
flutter run
```

### Web Admin Panel
```bash
cd web-app
npm install
npm run dev
```

## Deployment Targets

| Component | Platform | Status |
|-----------|----------|--------|
| Android App | Play Store | Ready |
| Web App | Cloud/On-prem | Ready |
| Server API | Docker/Cloud | Ready |
| Database | PostgreSQL | Ready |

## Domain Rules (Legal Compliance)

1. **Inspections**: Closed inspections are IMMUTABLE (court admissibility)
2. **Samples**: Dispatched samples are IMMUTABLE (chain-of-custody)
3. **Jurisdictions**: Data is jurisdiction-bound, not officer-bound
4. **Audit Trail**: All modifications are logged and traceable

## Documentation

See `/docs` folder for detailed documentation:
- Architecture overview
- Workflow diagrams
- API documentation
- Legal compliance notes

## Contributing

1. Read the architecture documentation
2. Follow the folder structure guidelines
3. Each folder has a README explaining its purpose
4. Code must be understandable without external context

## License

Proprietary - Government of India
