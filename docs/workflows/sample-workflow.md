# Sample Workflow (Chain of Custody)

## Status Flow

```
┌──────────┐
│ PENDING  │
└────┬─────┘
     │
     ▼
┌──────────────┐
│  COLLECTED   │
└────┬─────────┘
     │
     ▼
┌──────────────┐
│  DISPATCHED  │ ← IMMUTABLE FROM HERE
└────┬─────────┘
     │
     ▼
┌──────────────┐
│   AT_LAB     │
└────┬─────────┘
     │
     ▼
┌────────────────────┐
│  RESULT_RECEIVED   │
└────┬───────────────┘
     │
     ▼
┌──────────────┐
│  PROCESSED   │
└──────────────┘
```

## Status Definitions

### PENDING
- Sample record created
- Awaiting physical collection
- Can be modified or deleted

### COLLECTED
- Sample physically collected from FBO
- Details recorded (product, batch, quantity)
- Still modifiable for corrections

### DISPATCHED
- **IMMUTABLE FROM THIS POINT**
- Sample sent to laboratory
- Dispatch date recorded
- 14-day countdown begins

### AT_LAB
- Laboratory has received sample
- Testing in progress
- Cannot be modified

### RESULT_RECEIVED
- Lab report received
- Result recorded (conforming/non-conforming)
- Triggers next actions

### PROCESSED
- Final state
- All actions completed
- Archived for legal records

## Chain of Custody Requirements

### Why Immutability After Dispatch?

When a sample is dispatched to the lab, it becomes physical evidence.
Any modification to the digital record would break the chain of custody.

**Legal Requirements**:
1. Sample code must match physical sample
2. Dispatch date must be accurate
3. Lab report must link to original sample
4. No modifications allowed after dispatch

### Enforcement

```typescript
// Backend service check
if (sample.status === 'dispatched' || 
    sample.status === 'at_lab' ||
    sample.status === 'result_received' ||
    sample.status === 'processed') {
  throw new Error('Cannot modify dispatched sample');
}
```

## Lab Report Deadline

**Default**: 14 days from dispatch date

**Calculation**:
```typescript
const deadline = new Date(sample.dispatchDate);
deadline.setDate(deadline.getDate() + 14);
const daysRemaining = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
```

**Urgency Levels**:
- Green: > 7 days remaining
- Yellow: 3-7 days remaining
- Red: < 3 days remaining
- Critical: Overdue

## Sample Types

### Enforcement Sample
- Collected during violation investigation
- May lead to prosecution
- Stricter chain of custody

### Surveillance Sample
- Routine quality monitoring
- Statistical sampling
- May trigger enforcement if non-conforming
