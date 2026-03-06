# Pickup Requests API Spec

Manages customer pickup requests and driver acceptance. All endpoints are under `/api/v1/pickup-requests`.

**Auth:** All endpoints require a valid session cookie (`better-auth.session_token`).

**Response Envelope:**

```json
{ "status": "success" | "error", "message": "...", "data": { ... } | null }
```

---

## POST /api/v1/pickup-requests

Customer creates a new laundry pickup request. The server automatically assigns the nearest available outlet using the Haversine formula.

**Access:** `CUSTOMER`

**Request Body:**

```json
{
  "addressId": "addr_001",
  "scheduledAt": "2026-03-10T09:00:00.000Z"
}
```

**Response (Success — 201):**

```json
{
  "status": "success",
  "message": "Pickup request created",
  "data": {
    "id": "pkup_abc123",
    "customerId": "usr_abc123",
    "addressId": "addr_001",
    "outletId": "out_001",
    "outletName": "PrimeCare Jakarta Selatan",
    "driverId": null,
    "scheduledAt": "2026-03-10T09:00:00.000Z",
    "status": "PENDING",
    "createdAt": "2026-03-06T10:00:00.000Z"
  }
}
```

**Response (Error — 422):**

```json
{
  "status": "error",
  "message": "No outlet available in your area"
}
```

**Response (Error — 404):**

```json
{
  "status": "error",
  "message": "Address not found"
}
```

**Notes:**
- The server calculates the Haversine distance from the address coordinates to each active outlet's coordinates.
- The request is assigned to the nearest outlet within `outlet.maxServiceRadiusKm`.
- If no outlet is within range, return `422` — the request is not created.
- Unverified customers (`isVerified: false`) cannot create pickup requests.

---

## GET /api/v1/pickup-requests/my

List the authenticated customer's own pickup requests.

**Access:** `CUSTOMER`

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | `1` | Page number |
| `limit` | number | `10` | Items per page |
| `status` | string | — | Filter by status: `PENDING`, `DRIVER_ASSIGNED`, `PICKED_UP`, `CANCELLED` |

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Pickup requests retrieved",
  "data": [
    {
      "id": "pkup_abc123",
      "outletName": "PrimeCare Jakarta Selatan",
      "scheduledAt": "2026-03-10T09:00:00.000Z",
      "status": "PENDING",
      "createdAt": "2026-03-06T10:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 3
  }
}
```

---

## GET /api/v1/pickup-requests

List available pickup requests for the driver's outlet. Only shows `PENDING` requests by default.

**Access:** `DRIVER`

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | string | `PENDING` | Filter by status |
| `page` | number | `1` | Page number |
| `limit` | number | `10` | Items per page |

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Pickup requests retrieved",
  "data": [
    {
      "id": "pkup_abc123",
      "customerName": "John Doe",
      "address": {
        "label": "Home",
        "street": "Jl. Sudirman No. 1",
        "city": "Jakarta",
        "latitude": -6.2088,
        "longitude": 106.8456
      },
      "scheduledAt": "2026-03-10T09:00:00.000Z",
      "status": "PENDING",
      "createdAt": "2026-03-06T10:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 2
  }
}
```

**Notes:**
- Scoped to the driver's assigned outlet only.

---

## PATCH /api/v1/pickup-requests/:id/accept

Driver accepts a pickup request. Sets the order status to `LAUNDRY_EN_ROUTE_TO_OUTLET`.

**Access:** `DRIVER`

**Path Params:**

| Param | Description |
|-------|-------------|
| `id` | PickupRequest UUID |

**Request Body:** None

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Pickup request accepted",
  "data": {
    "id": "pkup_abc123",
    "driverId": "usr_drv001",
    "status": "DRIVER_ASSIGNED",
    "orderStatus": "LAUNDRY_EN_ROUTE_TO_OUTLET"
  }
}
```

**Response (Error — 409):**

```json
{
  "status": "error",
  "message": "Driver already has an active task"
}
```

**Response (Error — 404):**

```json
{
  "status": "error",
  "message": "Pickup request not found"
}
```

**Notes:**
- **One-Task Rule:** Before accepting, the server checks for any active task:
  - `PickupRequest` where `driverId = driver.id` AND `status = 'DRIVER_ASSIGNED'`
  - `Delivery` where `driverId = driver.id` AND `status IN ['DRIVER_ASSIGNED', 'OUT_FOR_DELIVERY']`
  - If any active task exists → `409 Conflict`.
- Sets `PickupRequest.driverId` and advances the linked order status.

---

## PATCH /api/v1/pickup-requests/:id/complete

Driver marks the pickup as complete — laundry has been collected and is arriving at the outlet.

**Access:** `DRIVER`

**Path Params:**

| Param | Description |
|-------|-------------|
| `id` | PickupRequest UUID |

**Request Body:** None

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Pickup completed. Outlet admin notified.",
  "data": {
    "id": "pkup_abc123",
    "status": "PICKED_UP",
    "orderStatus": "LAUNDRY_ARRIVED_AT_OUTLET"
  }
}
```

**Response (Error — 403):**

```json
{
  "status": "error",
  "message": "You are not the assigned driver for this pickup"
}
```

**Notes:**
- Only the assigned driver (the one who accepted) can complete this request.
- Advances the linked order status to `LAUNDRY_ARRIVED_AT_OUTLET`.
- Triggers a notification to the outlet admin that laundry has arrived.
