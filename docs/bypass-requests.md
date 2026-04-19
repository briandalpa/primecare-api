# Bypass Requests API Spec

Manages the bypass approval workflow when workers detect quantity mismatches.
All endpoints are under `/api/v1/bypass-requests`.

**Auth:** All endpoints require a valid session cookie (`better-auth.session_token`).

**Response Envelope:**

```json
{ "status": "success" | "error", "message": "...", "data": { ... } | null }
```

---

## GET /api/v1/bypass-requests

List bypass requests for the outlet admin's outlet. Pending requests should be prominently surfaced in the UI.

**Access:** `OUTLET_ADMIN`, `SUPER_ADMIN`

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | `1` | Page number |
| `limit` | number | `10` | Items per page |
| `status` | string | — | Filter by status: `PENDING`, `APPROVED`, `REJECTED` |
| `outletId` | string | — | Filter by outlet (SUPER_ADMIN only) |
| `sortBy` | string | `createdAt` | Sort field |
| `order` | string | `desc` | `asc` or `desc` |

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Bypass requests retrieved",
  "data": [
    {
      "id": "bp_001",
      "orderId": "ord_xyz789",
      "station": "IRONING",
      "workerName": "Bob Ironing",
      "status": "PENDING",
      "createdAt": "2026-03-07T11:00:00.000Z",
      "resolvedAt": null
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 3,
    "totalPages": 1
  }
}
```

---

## GET /api/v1/bypass-requests/:id

Get detailed information about a specific bypass request, including mismatched quantities.

**Access:** `OUTLET_ADMIN` (own outlet), `SUPER_ADMIN`

**Path Params:**

| Param | Description |
|-------|-------------|
| `id` | BypassRequest UUID |

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Bypass request retrieved",
  "data": {
    "id": "bp_001",
    "orderId": "ord_xyz789",
    "stationRecordId": "sr_002",
    "station": "IRONING",
    "workerName": "Bob Ironing",
    "workerId": "staff_wrk002",
    "adminId": null,
    "problemDescription": null,
    "status": "PENDING",
    "createdAt": "2026-03-07T11:00:00.000Z",
    "resolvedAt": null,
    "referenceItems": [
      { "laundryItemId": "uuid-tshirt", "itemName": "T-Shirt", "quantity": 5 },
      { "laundryItemId": "uuid-trousers", "itemName": "Trousers", "quantity": 2 },
      { "laundryItemId": "uuid-jacket", "itemName": "Jacket", "quantity": 1 }
    ],
    "workerItems": [
      { "laundryItemId": "uuid-tshirt", "itemName": "T-Shirt", "quantity": 4 },
      { "laundryItemId": "uuid-trousers", "itemName": "Trousers", "quantity": 2 },
      { "laundryItemId": "uuid-jacket", "itemName": "Jacket", "quantity": 1 }
    ]
  }
}
```

**Notes:**
- `workerId` and `adminId` are **Staff UUIDs** (from the `Staff` table), not User UUIDs.
- `referenceItems` are from the previous station's `StationItem` records (or `OrderItem` for the first station).
- `workerItems` are the quantities the worker submitted when the mismatch was detected.
- Each item includes `laundryItemId` (for reference) and `itemName` (from the LaundryItem join, for display).

---

## PATCH /api/v1/bypass-requests/:id/approve

Outlet Admin approves a bypass request. Requires re-authentication (password check) and a written problem description. On approval, the order automatically advances to the next station.

**Access:** `OUTLET_ADMIN`

**Path Params:**

| Param | Description |
|-------|-------------|
| `id` | BypassRequest UUID |

**Request Body:**

```json
{
  "password": "AdminSecurePass123!",
  "problemDescription": "One T-Shirt was found damaged during ironing and removed from the batch."
}
```

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Bypass approved. Order advanced to next station.",
  "data": {
    "id": "bp_001",
    "status": "APPROVED",
    "adminId": "staff_admin01",
    "problemDescription": "One T-Shirt was found damaged during ironing and removed from the batch.",
    "resolvedAt": "2026-03-07T12:00:00.000Z",
    "orderStatus": "LAUNDRY_BEING_PACKED"
  }
}
```

**Response (Error — 401):**

```json
{
  "status": "error",
  "message": "Incorrect password"
}
```

**Response (Error — 422):**

```json
{
  "status": "error",
  "message": "Problem description is required"
}
```

**Response (Error — 409):**

```json
{
  "status": "error",
  "message": "Bypass request is not in PENDING state"
}
```

**Notes:**
- **Re-authentication is mandatory.** The session alone is insufficient. The server verifies the admin's current password before processing.
- `problemDescription` must be a non empty string, validation enforced server side.
- On approval:
  1. `BypassRequest.status` → `APPROVED`
  2. `BypassRequest.adminId`, `problemDescription`, `resolvedAt` are set.
  3. `StationRecord.status` → `COMPLETED`; `completedAt` is set.
  4. `Order.status` advances to the next station (using the same packing fork logic for the PACKING station).
- All bypass events are recorded with timestamps for the full audit trail.

---

## PATCH /api/v1/bypass-requests/:id/reject

Outlet Admin rejects a bypass request. The worker is notified and must re-enter the correct quantities.

**Access:** `OUTLET_ADMIN`

**Path Params:**

| Param | Description |
|-------|-------------|
| `id` | BypassRequest UUID |

**Request Body:**

```json
{
  "password": "AdminSecurePass123!"
}
```

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Bypass rejected. Worker must re-enter correct quantities.",
  "data": {
    "id": "bp_001",
    "status": "REJECTED",
    "adminId": "staff_admin01",
    "resolvedAt": "2026-03-07T12:30:00.000Z"
  }
}
```

**Response (Error — 401):**

```json
{
  "status": "error",
  "message": "Incorrect password"
}
```

**Notes:**
- Re-authentication (password check) is also required for rejection.
- On rejection:
  1. `BypassRequest.status` → `REJECTED`; `resolvedAt` is set.
  2. `StationRecord.status` → reverts to `IN_PROGRESS`.
  3. Worker is notified that the bypass was rejected and must correct their quantities.
- The worker can re-submit a new bypass request after correcting quantities.
