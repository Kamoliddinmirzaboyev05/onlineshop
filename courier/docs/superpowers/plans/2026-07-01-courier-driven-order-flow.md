# Courier-driven order flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the full order status chain while ensuring fresh customer orders appear in the courier app immediately.

**Architecture:** Backend keeps `pending -> confirmed -> preparing -> ready -> accepted -> delivering -> delivered`, with `cancelled` reachable from any non-terminal state. Courier list includes active unassigned orders immediately, so a new `pending` order is visible to couriers without admin approval. Frontends show all valid statuses and remove customer-confirmation copy.

**Tech Stack:** FastAPI + SQLAlchemy + PostgreSQL backend, React + TypeScript + Vite frontends.

## Global Constraints

- Keep `confirmed`, `preparing`, and `ready` in all status unions and backend enum.
- Admin may cancel non-terminal orders but does not assign couriers.
- Couriers self-claim active unassigned orders by setting `accepted`.
- Customer/TMA does not manually confirm delivery.

---

### Task 1: Admin Status Alignment

**Files:**
- Modify: `admin/src/types.ts`
- Modify: `admin/src/pages/OrdersPage.tsx`

**Interfaces:**
- Consumes: Backend `OrderOut.status`, including `accepted`.
- Produces: Admin order list that can label, color, filter, and sort `accepted`.

- [x] **Step 1: Add `accepted` to the admin `OrderStatus` union**

- [x] **Step 2: Add `accepted` to order filters, labels, badge colors, and rank sorting**

- [x] **Step 3: Remove stale customer-confirmation badge copy**

- [x] **Step 4: Verify admin build**

Run: `npm run build` from `admin/`.

Expected: TypeScript and Vite build pass.

---

### Task 2: Courier And TMA Copy Cleanup

**Files:**
- Modify: `courier/src/pages/OrdersPage.tsx`
- Modify: `tma/src/pages/OrdersPage.tsx`

**Interfaces:**
- Consumes: Existing courier `/courier/orders/{id}/delivered` endpoint.
- Produces: Delivery completion UI without customer-confirmation wait wording.

- [x] **Step 1: Update courier delivered toast**

- [x] **Step 2: Always show the courier "Yetkazdim" action while status is `delivering`**

- [x] **Step 3: Remove TMA order-list receipt-confirm prompt**

- [x] **Step 4: Verify TMA and courier builds/tests**

Run: `npm run build` from `tma/`.

Run: `npm test` and `npm run build` from `courier/`.

Expected: all commands pass.

---

### Task 3: Backend Documentation Comments

**Files:**
- Modify: `backend/app/initdb.py`

**Interfaces:**
- Consumes: Existing order columns.
- Produces: Comments that describe `courier_delivered_at` as the courier completion timestamp, not a customer-confirmation wait state.

- [x] **Step 1: Update stale migration comment**

- [x] **Step 2: Verify backend import**

Run: `./venv/bin/python -c "import app.main; print('backend import ok')"` from `backend/`.

Expected: prints `backend import ok`.

---

### Task 4: Spec Alignment

**Files:**
- Modify: `courier/docs/superpowers/specs/2026-07-01-courier-driven-order-flow-design.md`
- Modify: `courier/docs/superpowers/plans/2026-07-01-courier-driven-order-flow.md`

**Interfaces:**
- Consumes: The accepted product decision from 2026-07-02.
- Produces: Documentation that no longer tells future agents to remove `confirmed`, `preparing`, or `ready`.

- [x] **Step 1: Update the spec status model**

- [x] **Step 2: Replace the stale implementation plan**

- [x] **Step 3: Verify no old customer-confirmation or status-removal instructions remain in source**

Run a repository text search for the old customer-confirmation wording and the obsolete instruction to remove preparation statuses.

Expected: no source-code matches.
