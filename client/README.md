# Expo React Native App

## Layer: FRONTEND (Layer 1B - Development)

Expo React Native application for development and testing on Replit.

---

## Purpose

Development/testing app for Food Safety Officers. Use this on Replit for:
- Testing features before Flutter deployment
- QR code scanning via Expo Go on physical devices
- Web preview for quick iteration

**For production deployment**: Use the Flutter app in `/android-app`

---

## Running the App

The Expo app runs automatically on Replit via the "Start Frontend" workflow.

- **Web Preview**: View in Replit's webview panel
- **Physical Device**: Scan QR code with Expo Go app

---

## Structure

```
client/
├── App.tsx                    # App entry point
├── components/                # Reusable UI components
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Input.tsx
│   └── ThemedText.tsx
├── constants/
│   └── theme.ts               # Colors, spacing
├── context/
│   └── AuthContext.tsx        # Auth state provider
├── hooks/
│   ├── useAuth.ts             # Authentication hook
│   └── useTheme.ts            # Theme hook
├── lib/
│   ├── query-client.ts        # React Query setup
│   ├── storage.ts             # Async storage
│   └── file-storage.ts        # File upload service
├── navigation/
│   └── RootNavigator.tsx      # Navigation structure
├── screens/                   # App screens
│   ├── LoginScreen.tsx
│   ├── DashboardScreen.tsx
│   ├── InspectionsScreen.tsx
│   ├── SamplesScreen.tsx
│   ├── ScannerScreen.tsx
│   ├── CourtCasesScreen.tsx
│   └── ProfileScreen.tsx
└── types/
    └── index.ts               # TypeScript interfaces
```

---

## Layer Responsibilities

**This is a FRONTEND layer (Layer 1B).**

### MUST DO:
- Render UI based on backend state
- Collect user input and send to API
- Handle local UI state (loading, errors, navigation)
- Display validation errors from backend
- Use React Query for data fetching

### MUST NOT DO:
- Enforce business rules (backend does this)
- Make workflow decisions (ask backend)
- Bypass backend validation
- Store sensitive data without encryption
- Modify immutable records (backend will reject)

---

## API Configuration

The API URL is configured via environment variable:
- `EXPO_PUBLIC_DOMAIN`: Set automatically by Replit

```typescript
import { getApiUrl } from "@/lib/query-client";

const url = getApiUrl(); // Returns the full API base URL
```

---

## Immutability Handling

The app respects backend immutability rules:

```typescript
// Check status before allowing edits
if (inspection.status === "closed") {
  // Disable edit buttons, show read-only view
}
```

The backend returns 403 errors for:
- Editing closed inspections
- Modifying dispatched samples
- Changing immutable prosecution records

---

## Credentials (Development)

- **Test Officer**: officer@test.com / Officer@123
- **Super Admin**: superadmin / Admin@123

---

## Related Documentation

- [Architecture Guidelines](../docs/ARCHITECTURE.md)
- [Domain Layer](../server/domain/README.md)
- [Shared Types](../shared/README.md)
