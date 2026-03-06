# Stations API Spec

Manages worker station processing across three stations: `WASHING → IRONING → PACKING`.
All endpoints are under `/api/v1/orders/:id/stations`.

**Auth:** All endpoints require a valid session cookie (`better-auth.session_token`).

**Response Envelope:**

```json
{ "status": "success" | "error", "message": "...", "data": { ... } | null }
```

**Station Values:** `WASHING` | `IRONING` | `PACKING`

---

## GET /api/v1/orders/:id/stations

Get all station records for an order, including item quantities entered at each station.

**Access:** `WORKER`, `OUTLET_ADMIN`, `SUPER_ADMIN`

**Path Params:**

| Param | Description |
|-------|-------------|
| `id` | Order UUID |

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Station records retrieved",
  "data": [
    {
      "id": "sr_001",
      "station": "WASHING",
      "workerName": "Jane Washing",
      "status": "COMPLETED",
      "completedAt": "2026-03-07T09:00:00.000Z",
      "createdAt": "2026-03-07T08:00:00.000Z",
      "items": [
        { "itemName": "T-Shirt", "quantity": 5 },
        { "itemName": "Trousers", "quantity": 2 }
      ],
      "bypassRequest": null
    },
    {
      "id": "sr_002",
      "station": "IRONING",
      "workerName": "Bob Ironing",
      "status": "BYPASS_REQUESTED",
      "completedAt": null,
      "createdAt": "2026-03-07T10:00:00.000Z",
      "items": [
        { "itemName": "T-Shirt", "quantity": 4 },
        { "itemName": "Trousers", "quantity": 2 }
      ],
      "bypassRequest": {
        "id": "bp_001",
        "status": "PENDING"
      }
    }
  ]
}
```

---

## POST /api/v1/orders/:id/stations/:station/start

Worker claims a station and begins processing. Creates a `StationRecord` with `status: 'IN_PROGRESS'`.

**Access:** `WORKER` (matching `workerType` for the station; must be on an active shift)

**Path Params:**

| Param | Description |
|-------|-------------|
| `id` | Order UUID |
| `station` | `WASHING`, `IRONING`, or `PACKING` |

**Request Body:** None

**Response (Success — 201):**

```json
{
  "status": "success",
  "message": "Station started",
  "data": {
    "id": "sr_003",
    "orderId": "ord_xyz789",
    "station": "IRONING",
    "workerId": "usr_wrk001",
    "status": "IN_PROGRESS",
    "previousStationItems": [
      { "itemName": "T-Shirt", "quantity": 5 },
      { "itemName": "Trousers", "quantity": 2 }
    ],
    "createdAt": "2026-03-07T10:00:00.000Z"
  }
}
```

**Response (Error — 403):**

```json
{
  "status": "error",
  "message": "Worker is not on an active shift"
}
```

**Response (Error — 409):**

```json
{
  "status": "error",
  "message": "This station is already in progress or completed"
}
```

**Notes:**
- Returns `previousStationItems` so the worker can see the reference quantities (read-only) while entering their own.
- For `WASHING`, `previousStationItems` comes from `OrderItem` (admin-entered quantities).
- Worker's `workerType` must match the station (e.g., a `WASHING` worker cannot start `IRONING`).

---

## PATCH /api/v1/orders/:id/stations/:station/complete

Worker submits item quantities and attempts to complete the station.

- **If quantities match:** station is marked `COMPLETED`; order advances to the next status.
- **If quantities mismatch:** returns `409` and the worker must submit a bypass request instead.

**Access:** `WORKER` (must own this station's `StationRecord`; must be on active shift)

**Path Params:**

| Param | Description |
|-------|-------------|
| `id` | Order UUID |
| `station` | `WASHING`, `IRONING`, or `PACKING` |

**Request Body:**

```json
{
  "items": [
    { "itemName": "T-Shirt", "quantity": 5 },
    { "itemName": "Trousers", "quantity": 2 },
    { "itemName": "Jacket", "quantity": 1 }
  ]
}
```

**Response (Success — 200, quantities match):**

```json
{
  "status": "success",
  "message": "Station completed",
  "data": {
    "stationRecordId": "sr_001",
    "station": "WASHING",
    "status": "COMPLETED",
    "completedAt": "2026-03-07T09:00:00.000Z",
    "orderStatus": "LAUNDRY_BEING_IRONED"
  }
}
```

**Response (Success — 200, Packing station, payment unpaid):**

```json
{
  "status": "success",
  "message": "Packing complete. Awaiting payment.",
  "data": {
    "stationRecordId": "sr_003",
    "station": "PACKING",
    "status": "COMPLETED",
    "completedAt": "2026-03-07T15:00:00.000Z",
    "orderStatus": "WAITING_FOR_PAYMENT"
  }
}
```

**Response (Success — 200, Packing station, payment already paid):**

```json
{
  "status": "success",
  "message": "Packing complete. Order ready for delivery.",
  "data": {
    "stationRecordId": "sr_003",
    "station": "PACKING",
    "status": "COMPLETED",
    "completedAt": "2026-03-07T15:00:00.000Z",
    "orderStatus": "LAUNDRY_READY_FOR_DELIVERY",
    "deliveryId": "del_001"
  }
}
```

**Response (Error — 409, quantities mismatch):**

```json
{
  "status": "error",
  "message": "Quantity mismatch. Submit a bypass request to proceed."
}
```

**Notes — Station Progression:**

| Completed Station | Next Order Status |
|-------------------|-------------------|
| `WASHING` | `LAUNDRY_BEING_IRONED` |
| `IRONING` | `LAUNDRY_BEING_PACKED` |
| `PACKING` (unpaid) | `WAITING_FOR_PAYMENT` |
| `PACKING` (paid) | `LAUNDRY_READY_FOR_DELIVERY` + create `Delivery` |

**Packing Fork Logic (server-side):**
```
if order.paymentStatus === 'UNPAID'  → order.status = 'WAITING_FOR_PAYMENT'
if order.paymentStatus === 'PAID'    → order.status = 'LAUNDRY_READY_FOR_DELIVERY'
                                        + create Delivery { status: 'PENDING' }
```

---

## POST /api/v1/orders/:id/stations/:station/bypass

Worker submits a bypass request when quantities do not match the previous station. Sets `StationRecord.status = 'BYPASS_REQUESTED'` and creates a `BypassRequest` record.

**Access:** `WORKER` (must own this station's `StationRecord`; must be on active shift)

**Path Params:**

| Param | Description |
|-------|-------------|
| `id` | Order UUID |
| `station` | `WASHING`, `IRONING`, or `PACKING` |

**Request Body:**

```json
{
  "items": [
    { "itemName": "T-Shirt", "quantity": 4 },
    { "itemName": "Trousers", "quantity": 2 },
    { "itemName": "Jacket", "quantity": 1 }
  ]
}
```

**Response (Success — 201):**

```json
{
  "status": "success",
  "message": "Bypass request submitted. Awaiting admin approval.",
  "data": {
    "bypassRequestId": "bp_001",
    "stationRecordId": "sr_002",
    "status": "PENDING",
    "createdAt": "2026-03-07T11:00:00.000Z"
  }
}
```

**Response (Error — 409):**

```json
{
  "status": "error",
  "message": "A pending bypass request already exists for this station"
}
```

**Notes:**
- A bypass request can only be submitted when quantities **do not match** the reference quantities.
- Only one `PENDING` bypass per station record at a time.
- The station record is blocked (cannot be completed) until the bypass is resolved by the outlet admin.
- If bypass is **rejected**, the worker must re-enter correct quantities and can attempt to complete or submit a new bypass.
