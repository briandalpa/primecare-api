# Dashboard API Spec

Provides summary statistics for the admin dashboard.

**Auth:** Requires `requireStaffRole('SUPER_ADMIN', 'OUTLET_ADMIN')`.

**Response Envelope:**

```json
{ "status": "success" | "error", "message": "...", "data": { ... } | null }
```

---

## GET /api/v1/admin/dashboard

Retrieve dashboard summary statistics.

**Access:** `SUPER_ADMIN`, `OUTLET_ADMIN`

**Access scoping:**
- `SUPER_ADMIN`: platform-wide totals across all outlets.
- `OUTLET_ADMIN`: totals scoped to their assigned outlet.

**Query Parameters:** None

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Dashboard stats retrieved",
  "data": {
    "totalOrders": 142,
    "activeOutlets": 5,
    "registeredUsers": 380,
    "revenueMtd": 4250000,
    "recentOrders": [
      {
        "id": "ord_xyz789",
        "customerName": "John Doe",
        "status": "LAUNDRY_BEING_WASHED",
        "outletName": "PrimeCare Jakarta Selatan",
        "createdAt": "2026-04-20T08:00:00.000Z"
      }
    ]
  }
}
```

**Notes:**

- `revenueMtd` — sum of `totalPrice` for orders with `status = 'COMPLETED'` in the current calendar month.
- `recentOrders` — last 5 orders by `createdAt` descending (most recent first).
- `activeOutlets` — count of outlets with `isActive = true`. For `OUTLET_ADMIN`, this is always `1` (their own outlet).
- `registeredUsers` — count of `User` records (customers only, no staff). For `OUTLET_ADMIN`, this reflects users who have placed orders at their outlet.
