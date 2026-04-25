# Shifts API Spec

Manages worker shift scheduling. Workers must have an active shift to process orders at a station (`POST /api/v1/worker/orders/:id/process`).

**Auth:** All endpoints require `requireStaffRole('SUPER_ADMIN', 'OUTLET_ADMIN')`.

**Response Envelope:**

```json
{ "status": "success" | "error", "message": "...", "data": { ... } | null }
```

---

## POST /api/v1/shifts

Start a new shift for a worker.

**Access:** `SUPER_ADMIN`, `OUTLET_ADMIN`

**Request Body:**

```json
{
  "staffId": "staff_wrk001",
  "startedAt": "2026-03-07T07:00:00.000Z"
}
```

**Response (Success — 201):**

```json
{
  "status": "success",
  "message": "Shift started",
  "data": {
    "id": "shift_001",
    "staffId": "staff_wrk001",
    "workerType": "WASHING",
    "workerName": "Jane Washing",
    "outletId": "out_001",
    "outletName": "PrimeCare Jakarta Selatan",
    "startedAt": "2026-03-07T07:00:00.000Z",
    "endedAt": null,
    "isActive": true
  }
}
```

**Response (Error — 404):**

```json
{
  "status": "error",
  "message": "Staff not found"
}
```

**Response (Error — 409):**

```json
{
  "status": "error",
  "message": "Staff already has an active shift"
}
```

**Notes:**

- Only staff with role `WORKER` can be assigned a shift.
- `OUTLET_ADMIN` can only start shifts for workers at their own outlet.

---

## GET /api/v1/shifts

List shifts with pagination and optional filtering.

**Access:** `SUPER_ADMIN`, `OUTLET_ADMIN` (scoped to own outlet)

**Query Parameters:**

| Param      | Type    | Default | Description                          |
| ---------- | ------- | ------- | ------------------------------------ |
| `page`     | number  | `1`     | Page number                          |
| `limit`    | number  | `10`    | Items per page                       |
| `staffId`  | string  | —       | Filter by Staff UUID                 |
| `outletId` | string  | —       | Filter by Outlet UUID (SUPER_ADMIN only) |
| `isActive` | boolean | —       | Filter by active status              |

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Shifts retrieved",
  "data": [
    {
      "id": "shift_001",
      "staffId": "staff_wrk001",
      "workerType": "WASHING",
      "workerName": "Jane Washing",
      "outletId": "out_001",
      "outletName": "PrimeCare Jakarta Selatan",
      "startedAt": "2026-03-07T07:00:00.000Z",
      "endedAt": null,
      "isActive": true
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "totalPages": 1
  }
}
```

---

## PATCH /api/v1/shifts/:id/end

End an active shift.

**Access:** `SUPER_ADMIN`, `OUTLET_ADMIN`

**Path Params:**

| Param | Description |
| ----- | ----------- |
| `id`  | Shift UUID  |

**Request Body:** None

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Shift ended",
  "data": {
    "id": "shift_001",
    "isActive": false,
    "endedAt": "2026-03-07T15:00:00.000Z"
  }
}
```

**Response (Error — 404):**

```json
{
  "status": "error",
  "message": "Shift not found"
}
```

**Response (Error — 409):**

```json
{
  "status": "error",
  "message": "Shift has already ended"
}
```
