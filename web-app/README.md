# Web App (Admin & Authority Panel)

## Purpose
Browser-based dashboards for Super Admin, FSO, DO, and Commissioner roles.
Deployable to any web hosting platform.

## What This Folder MUST Contain
- React-based admin interface
- Role-based UI rendering
- Dashboard components
- Form components for data management

## What This Folder MUST NOT Contain
- Backend business logic
- Direct database access
- Workflow rule enforcement
- Server-side code

## Structure
```
web-app/
├── src/
│   ├── pages/           # Route-based pages
│   ├── components/      # Reusable UI components
│   ├── services/        # API clients
│   ├── state/           # State management
│   └── models/          # TypeScript interfaces
├── public/              # Static assets
└── package.json         # Dependencies
```

## Build & Deploy
```bash
# Development
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

## Environment Configuration
- `.env.development` - Development API endpoints
- `.env.production` - Production API endpoints

## Notes
- All business logic comes from backend API
- UI reflects backend workflow state
- Role-based access control enforced by backend
