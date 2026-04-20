# Deliveries API Spec

Manages laundry delivery requests assigned to drivers after payment is confirmed.
All endpoints are under `/api/v1/deliveries`.

**Auth:** All endpoints require a valid session cookie (`better-auth.session_token`).

**Response Envelope:**

```json
{ "status": "success" | "error", "message": "...", "data": { ... } | null }
```

---

## GET /api/v1/deliveries

List available delivery requests for the driver's outlet. Only `PENDING` deliveries are shown by default, deliveries are only dispatched after the order's payment is `PAID`.

**Access:** `DRIVER`

**Query Parameters:**

| Param    | Type   | Default   | Description                                                                     |
| -------- | ------ | --------- | ------------------------------------------------------------------------------- |
| `page`   | number | `1`       | Page number                                                                     |
| `limit`  | number | `10`      | Items per page                                                                  |
| `status` | string | `PENDING` | Filter by status: `PENDING`, `DRIVER_ASSIGNED`, `OUT_FOR_DELIVERY`, `DELIVERED` |

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Deliveries retrieved",
  "data": [
    {
      "id": "del_001",
      "orderId": "ord_xyz789",
      "customerName": "John Doe",
      "deliveryAddress": {
        "label": "Home",
        "street": "Jl. Sudirman No. 1",
        "city": "Jakarta",
        "latitude": -6.2088,
        "longitude": 106.8456
      },
      "status": "PENDING",
      "createdAt": "2026-03-08T08:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

**Notes:**

- Scoped to the driver's assigned outlet only.
- Deliveries with `status = 'PENDING'` are those waiting for a driver to accept.
- A delivery only appears here after the linked order's `paymentStatus` is `PAID`.

---

## PATCH /api/v1/deliveries/:id/accept

Driver accepts a delivery request. Sets delivery status to `DRIVER_ASSIGNED` and order status to `LAUNDRY_OUT_FOR_DELIVERY`.

**Access:** `DRIVER`

**Path Params:**

| Param | Description   |
| ----- | ------------- |
| `id`  | Delivery UUID |

**Request Body:** None

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Delivery accepted",
  "data": {
    "id": "del_001",
    "driverId": "staff_drv001",
    "status": "DRIVER_ASSIGNED",
    "orderStatus": "LAUNDRY_OUT_FOR_DELIVERY"
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
  "message": "Delivery not found"
}
```

**Notes:**

- **One-Task Rule:** Before accepting, the server checks for any active task:
  - `PickupRequest` where `driverId = driver.id` AND `status = 'DRIVER_ASSIGNED'`
  - `Delivery` where `driverId = driver.id` AND `status IN ['DRIVER_ASSIGNED', 'OUT_FOR_DELIVERY']`
  - If any active task exists → `409 Conflict`.
- Sets `Delivery.driverId` (Staff UUID) and advances `Order.status` to `LAUNDRY_OUT_FOR_DELIVERY`.

---

## PATCH /api/v1/deliveries/:id/complete

Driver marks the delivery as complete — laundry has been handed to the customer.
Sets delivery status to `DELIVERED` and order status to `LAUNDRY_DELIVERED_TO_CUSTOMER`. Starts the 48 hour auto confirm countdown.

**Access:** `DRIVER`

**Path Params:**

| Param | Description   |
| ----- | ------------- |
| `id`  | Delivery UUID |

**Request Body:** None

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Delivery completed. Customer notified.",
  "data": {
    "id": "del_001",
    "status": "DELIVERED",
    "deliveredAt": "2026-03-09T14:00:00.000Z",
    "orderStatus": "LAUNDRY_DELIVERED_TO_CUSTOMER"
  }
}
```

**Response (Error — 403):**

```json
{
  "status": "error",
  "message": "You are not the assigned driver for this delivery"
}
```

**Notes:**

- Only the assigned driver (the one who accepted) can complete this delivery.
- Sets `Delivery.deliveredAt = now` and `Order.status = 'LAUNDRY_DELIVERED_TO_CUSTOMER'`.
- The auto confirm background job will set `Order.status = 'COMPLETED'` if the customer does not confirm within **2×24 hours**.

---

## GET /api/v1/deliveries/history

> **Note for implementers:** Register this route in Express **before** `GET /deliveries/:id`; otherwise Express will match `history` as the `:id` parameter.

List the driver's own completed delivery history, paginated and filterable by date.

**Access:** `DRIVER`

**Query Parameters:**

| Param      | Type   | Default       | Description                                     |
| ---------- | ------ | ------------- | ----------------------------------------------- |
| `page`     | number | `1`           | Page number                                     |
| `limit`    | number | `10`          | Items per page                                  |
| `fromDate` | string | —             | ISO 8601 date; filter `deliveredAt >= fromDate` |
| `toDate`   | string | —             | ISO 8601 date; filter `deliveredAt <= toDate`   |
| `sortBy`   | string | `deliveredAt` | Sort field                                      |
| `order`    | string | `desc`        | `asc` or `desc`                                 |

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Delivery history retrieved",
  "data": [
    {
      "id": "del_001",
      "orderId": "ord_xyz789",
      "customerName": "John Doe",
      "deliveryAddress": {
        "label": "Home",
        "street": "Jl. Sudirman No. 1",
        "city": "Jakarta"
      },
      "status": "DELIVERED",
      "deliveredAt": "2026-03-09T14:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 12,
    "totalPages": 2
  }
}
```

**Notes:**

- Returns only deliveries where `Delivery.driverId = currentDriver.id`.
- All pagination and filtering is performed server side.
