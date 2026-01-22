# Domain Layer

## Layer: DOMAIN / BUSINESS LOGIC (Layer 2B)

This directory contains all business logic and domain rules for the Food Safety Inspector system.

---

## Purpose

The domain layer is the **single source of truth** for all business and legal rules.
No other layer should make workflow decisions or enforce regulatory constraints.

---

## Structure

```
domain/
├── index.ts                    # Central exports
├── inspection/
│   └── inspection.service.ts   # Inspection workflow rules
├── sample/
│   └── sample.service.ts       # Sample chain-of-custody rules
├── officer/
│   └── officer.service.ts      # Officer authentication & permissions
└── jurisdiction/
    └── jurisdiction.service.ts # Jurisdiction hierarchy rules
```

---

## Responsibilities

### MUST DO:
- Enforce ALL business and legal rules
- Validate workflow state transitions
- Check permissions and authorization
- Apply immutability rules for legal compliance
- Return clear success/failure results

### MUST NOT DO:
- Execute HTTP operations (that's the API layer)
- Render UI or handle user input (that's frontend)
- Execute raw database queries (use repositories)
- Log user activity (that's infrastructure)

---

## Domain Rules Enforced

### 1. Inspection Immutability
- Closed inspections become IMMUTABLE
- No modifications allowed after closure
- Required for court admissibility

### 2. Sample Chain-of-Custody
- Dispatched samples become IMMUTABLE
- Workflow: collected → dispatched → at_lab → result_received → processed
- Required for evidence integrity

### 3. Jurisdiction Binding
- All data is bound to jurisdictions, not officers
- Officers can only access data in their assigned jurisdictions
- Officer transfers do not affect data ownership

### 4. Workflow Transitions
- Status changes must follow allowed paths
- No direct jumps (e.g., draft → closed) unless explicitly allowed
- Transitions are configurable, not hardcoded

---

## Usage Pattern

```typescript
import { inspectionService } from "@/domain";

// Route handler calls domain service
app.put("/api/inspection/:id", async (req, res) => {
  const result = await inspectionService.updateInspection(
    req.params.id,
    req.body,
    { officerId, jurisdictionId }
  );
  
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  
  res.json(result.data);
});
```

---

## Adding New Domain Logic

1. Create a new directory for the domain entity
2. Create a service file with proper header comments
3. Export from `index.ts`
4. Document rules in this README
5. Create corresponding repository if needed

---

## File Header Template

```typescript
/**
 * =============================================================================
 * FILE: server/domain/[entity]/[entity].service.ts
 * LAYER: DOMAIN / BUSINESS LOGIC (Layer 2)
 * =============================================================================
 * 
 * PURPOSE:
 * [What this service does]
 * 
 * WHAT THIS FILE MUST DO:
 * - [Responsibility 1]
 * 
 * WHAT THIS FILE MUST NOT DO:
 * - Execute HTTP operations
 * - Perform raw database queries
 * - Render UI
 * 
 * DOMAIN RULES ENFORCED:
 * - [Rule 1]
 * 
 * DEPENDENT SYSTEMS:
 * - server/data/repositories/[entity].repository.ts
 * =============================================================================
 */
```
