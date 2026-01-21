# Food Safety Inspector - Government-Grade Regulatory System

## Overview
This project is a government-grade regulatory system designed for Food Safety Officers (FSOs) to manage inspection, sample collection, and prosecution workflows. It ensures compliance with FSSAI regulations and generates court-admissible records with strict immutability rules. The system aims to streamline regulatory processes, enhance legal compliance, and provide robust tools for food safety management.

## User Preferences
- Prefer detailed explanations
- Iterative development approach
- Ask before major changes
- Do not modify `server/templates` folder

## System Architecture

### Architectural Principles
The system adheres to core principles for a government-grade system: explicit updates, clear layer boundaries, domain-driven design with business rules enforced in the domain layer, immutability for closed records and legal compliance, and a comprehensive audit trail for all changes.

### Project Structure
The project is structured into distinct layers:
- **Presentation Layer**: `android-app/` (Flutter for production), `client/` (Expo for development/testing), and `web-app/` (React Admin for future web interface).
- **Backend Layer**: `server/` containing `domain/` for business logic, `data/` for data access (repository pattern), and `services/` for infrastructure.
- **Shared Layer**: `shared/` for common types and contracts.
- **Infrastructure**: `infra/` for Docker and deployment.

### UI/UX and Features
The mobile applications (Flutter and Expo) provide a comprehensive suite of features including:
- Officer authentication and profile management.
- Dashboard for key metrics and urgent actions.
- Management of FBO and Institutional inspections with detailed forms (e.g., 35-indicator FSSAI assessment).
- Sample tracking with chain-of-custody.
- Complaint management with public submission capabilities and evidence collection.
- Court case management with hearing tracking.
- Action dashboard for follow-ups.
- QR/Barcode scanning, GPS tracking, and PDF report generation.
- Anti-fraud watermarking for evidence images, embedding GPS and timestamps.
- Dynamic form configuration for inspections and complaints via admin panels.

### Backend Architecture
The backend uses Express.js with a strict layered architecture:
- **API Layer**: Handles HTTP endpoints.
- **Domain Layer**: Encapsulates business logic and rules, including legal compliance such as immutability for closed inspections and dispatched samples, jurisdiction-bound data, and audit trails.
- **Data Access Layer**: Manages database operations.
- **Services Layer**: Provides infrastructure services like PDF generation and file storage.
- **Configuration Layer**: Manages application settings.

## Security Architecture (Production-Grade)

### Security Middleware Stack
The server implements enterprise-grade security through a layered middleware stack:
1. **Request ID Tracking** - Unique ID per request for tracing (`x-request-id` header)
2. **Security Headers (Helmet)** - CSP, HSTS, X-Frame-Options, X-Content-Type-Options
3. **CORS Configuration** - Controlled cross-origin access for API endpoints
4. **Input Sanitization** - XSS prevention via HTML entity encoding
5. **Rate Limiting** - General (100 req/15min), Auth (5 req/15min)
6. **Audit Logging** - Append-only immutable logs for all data changes

### Key Security Files
- `server/middleware/security.ts` - Rate limiting, sanitization, security headers
- `server/middleware/audit.ts` - Immutable audit trail with buffered writes
- `server/middleware/error-handler.ts` - Global error handling, crash reporting
- `server/middleware/validation.ts` - Zod schema validation
- `server/services/jwt.service.ts` - JWT access/refresh token management
- `server/services/logger.ts` - Winston structured logging

### Authentication
- **Admin Panel**: Session-based (cookie) authentication
- **Mobile App**: JWT with refresh tokens (15min access, 7-day refresh)
- **Token Storage**: In-memory with automatic cleanup (use Redis in production)

### Audit Trail
- Records all CREATE, UPDATE, DELETE, READ, LOGIN, LOGOUT actions
- Captures officer ID, IP address, user agent, before/after values
- Buffered writes (5 second flush or 100 entries) for performance
- Append-only for legal compliance and court admissibility

### Environment Variables Required for Production
- `JWT_SECRET` - Secret key for JWT signing
- `REFRESH_SECRET` - Secret key for refresh token signing
- `NODE_ENV` - Set to "production" for production mode

## External Dependencies
- **Database**: PostgreSQL (managed via Drizzle ORM).
- **PDF Generation**: pdfkit.
- **File Storage**: Local filesystem with custom API endpoints.
- **Authentication**: Session-based for admin, JWT tokens for mobile.
- **Potential Integration**: Twilio (for Mobile OTP Authentication).

## Mobile App Production Features (Flutter)

### Network Service (`android-app/lib/services/network_service.dart`)
- Exponential backoff retry (3 retries, 1s → 2s → 4s delays)
- Offline queue for mutations when network unavailable
- Automatic token refresh on 401 errors
- Connectivity monitoring with status stream

### Connectivity Service (`android-app/lib/services/connectivity_service.dart`)
- Real-time network status monitoring
- OfflineBanner widget for user feedback
- ConnectivityWrapper for automatic UI integration
- Riverpod state management integration

### Crash Reporter (`android-app/lib/services/crash_reporter.dart`)
- Automatic Flutter error capture
- Breadcrumb trail for error context (last 50 actions)
- User context for debugging
- Device info collection
- Backend reporting endpoint support

### Key Mobile Services
- `network_service.dart` - Production networking with retry/offline support
- `connectivity_service.dart` - UI widgets for connectivity status
- `crash_reporter.dart` - Error capture and reporting
- `auth_service.dart` - JWT with refresh token handling

## Recent Changes (January 21, 2026)
- Added production-grade security hardening with rate limiting, Helmet headers, XSS prevention
- Implemented comprehensive input validation with Zod schemas for all entities
- Added immutable audit trail system for legal compliance
- Created global error handling with Winston structured logging
- Built JWT authentication service with refresh tokens
- Added 4 new database tables: audit_logs, refresh_tokens, rate_limit_records, system_health_metrics
- Added Flutter production networking: retry logic, offline queue, connectivity monitoring
- Added crash reporting service with breadcrumb trail for debugging
- Integrated automatic token refresh on 401 errors