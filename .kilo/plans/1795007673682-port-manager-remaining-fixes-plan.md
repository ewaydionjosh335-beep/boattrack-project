# Port Manager Remaining Fixes & Logic Audit Plan

## Goal
Identify, analyze, and structure the remaining bug fixes, error handling improvements, and logic refinements for the Port Manager module (`manager/*.html`, `js/api.js`) that are self-contained within port manager operations.

---

## Identified Audit Findings & Planned Fixes

### 1. Strict Arrival Validation (`markArrived`)
- **Current State**: `api.trips.markArrived()` checks only if `trip_status === 'Departed'` and directly sets it to `'Arrived'`.
- **Issue / Logic Gap**: Lacks verification for post-arrival inspection or arrival time sanity check.
- **Fix**: Add validation requiring a completed post-arrival inspection or valid arrival timestamp check before marking a trip as `'Arrived'`.

### 2. Comprehensive Trip Deletion & Orphan Prevention
- **Current State**: `api.trips.delete()` checks manifests, bookings, and departure approvals.
- **Issue / Logic Gap**: Does not check for associated payment records (`payments`) or e-tickets (`etickets`) linked via bookings/manifests.
- **Fix**: Update `api.trips.delete()` to check and prevent deletion if active payments or e-tickets are attached.

### 3. Departure Approval Auto-Refresh (`manager/departure-approval.html`)
- **Current State**: `manager/departure-approval.html` loads once without auto-sync.
- **Issue / Logic Gap**: Port managers must manually reload to see new coast guard approvals or held status changes (unlike SOS alerts and trip schedules which use `ui.setupSync`).
- **Fix**: Integrate `ui.setupSync(render)` in `manager/departure-approval.html` with proper DOM diffing/state preservation.

### 4. Payments Filter Persistence (`manager/payments.html`)
- **Current State**: Background sync in `manager/payments.html` can reset active vessel or date filters.
- **Issue / Logic Gap**: User filter selections are overwritten during periodic data refresh.
- **Fix**: Capture and restore filter dropdown values before re-rendering tables in `manager/payments.html`.

---

## Validation Plan
1. **Browser Testing (`port_manager` role)**:
   - Log in as `port_manager`.
   - Verify auto-refresh on Departure Approval page without losing input focus or scrolling.
   - Verify payment filter persistence during sync.
   - Test strict trip arrival and deletion guard constraints.
2. **Console & Error Check**: Ensure zero console errors across all 9 port manager pages.
