# Order Success And Courier Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make customer order submission visibly confirmed in TMA and make new courier orders hard to miss with accept buttons and audible alerts.

**Architecture:** TMA passes `placed=1` after checkout and renders a prominent success panel on the order detail screen. Courier uses a shared `isAcceptableOrderStatus` helper to show accept buttons for fresh/preparation-stage orders on the dashboard and order list. Web Push remains the background notification mechanism; foreground push also plays the bundled alert sound.

**Tech Stack:** React + TypeScript + Vite for TMA and courier PWA; existing Web Push service worker for courier notifications.

## Global Constraints

- Keep the full status chain: `pending`, `confirmed`, `preparing`, `ready`, `accepted`, `delivering`, `delivered`, `cancelled`.
- New unassigned orders are acceptable while status is `pending`, `confirmed`, `preparing`, or `ready`.
- Browser/PWA cannot force custom audio while the app is closed; background notifications use OS notification sound.

---

### Task 1: TMA Submitted State

**Files:**
- Modify: `tma/src/pages/CheckoutPage.tsx`
- Modify: `tma/src/pages/OrderDetailPage.tsx`

**Interfaces:**
- Consumes: Created `Order.id` and `Order.number`.
- Produces: `/orders/:id?placed=1` success state.

- [x] **Step 1: Navigate with `placed=1` after successful checkout**

- [x] **Step 2: Render a visible success panel on order detail**

- [x] **Step 3: Verify TMA build**

Run: `npm run build` from `tma/`.

Expected: TypeScript and Vite build pass.

---

### Task 2: Courier Accept Cards And Alerts

**Files:**
- Create: `courier/src/lib/orderActions.ts`
- Create: `courier/src/test/orderActions.test.ts`
- Modify: `courier/src/pages/DashboardPage.tsx`
- Modify: `courier/src/pages/OrdersPage.tsx`
- Modify: `courier/src/components/Layout.tsx`
- Modify: `courier/src/components/PushBridge.tsx`
- Modify: `courier/src/push.ts`
- Modify: `courier/public/sw.js`

**Interfaces:**
- Consumes: `GET /courier/orders`, `PATCH /courier/orders/{id}`.
- Produces: Dashboard accept cards, shared accept-status helper, foreground audio alert, stronger background notification.

- [x] **Step 1: Write failing test for acceptable order statuses**

- [x] **Step 2: Add `isAcceptableOrderStatus` helper**

- [x] **Step 3: Use helper in order list and dashboard cards**

- [x] **Step 4: Play alert sound on foreground push and new-order polling**

- [x] **Step 5: Mark background notification as audible and persistent**

- [x] **Step 6: Verify courier tests and build**

Run: `npm test` and `npm run build` from `courier/`.

Expected: all tests and build pass.
