# Inspection Workflow

## Status Flow

```
┌──────────┐
│  DRAFT   │
└────┬─────┘
     │
     ▼
┌──────────────┐
│ IN_PROGRESS  │
└────┬─────────┘
     │
     ├─────────────────────┐
     ▼                     ▼
┌──────────────┐   ┌──────────────────┐
│  COMPLETED   │   │ REQUIRES_FOLLOWUP│
└────┬─────────┘   └────────┬─────────┘
     │                      │
     │      ┌───────────────┘
     ▼      ▼
┌──────────────┐
│    CLOSED    │ ← IMMUTABLE (Legal Requirement)
└──────────────┘
```

## Status Definitions

### DRAFT
- Initial state when inspection is created
- Officer can modify all fields
- Not visible to other officers

### IN_PROGRESS
- Inspection is being conducted
- Officer is on-site at FBO
- Can add findings, deviations, actions

### COMPLETED
- Inspection is finished
- All required fields must be filled
- Awaiting final review

### REQUIRES_FOLLOWUP
- Inspection needs additional action
- May require return visit
- Links to follow-up inspection

### CLOSED
- **IMMUTABLE STATE**
- Cannot be modified for any reason
- Legal record for court proceedings
- Only status that cannot transition

## Transition Rules

| From | To | Conditions |
|------|-----|------------|
| draft | in_progress | Officer starts inspection |
| draft | closed | Cancelled (with reason) |
| in_progress | completed | All mandatory fields filled |
| in_progress | requires_followup | Issues need follow-up |
| completed | closed | Final approval |
| requires_followup | completed | Follow-up done |
| requires_followup | closed | Closed with notes |

## Immutability Rule

**WHY**: Closed inspections are used as evidence in court cases.
Modifying them after closure would compromise legal proceedings.

**ENFORCEMENT**:
1. Backend service checks status before any update
2. Database triggers prevent modification of closed records
3. Audit log captures all access attempts

## Jurisdiction Binding

Inspections are bound to jurisdictions, not officers.
When an officer transfers, their inspections remain in the original jurisdiction.

```typescript
// Example: Inspection belongs to jurisdiction, not officer
inspection.jurisdictionId = "jurisdiction-123";
inspection.officerId = "officer-456"; // For audit only
```
