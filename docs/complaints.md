# Complaints API Spec

Manages customer complaints for orders that were returned damaged or with missing items.
All endpoints are under `/api/v1/complaints`.

**Auth:** All endpoints require a valid session cookie (`better-auth.session_token`).

**Response Envelope:**

```json
{ "status": "success" | "error", "message": "...", "data": { ... } | null }
```

---

## POST /api/v1/complaints

Customer files a complaint about a completed order.

**Access:** `CUSTOMER`

**Request Body:**

```json
{
  "orderId": "ord_xyz789",
  "description": "Two shirts are missing and one jacket has a stain that wasn't there before."
}
```

**Response (Success — 201):**

```json
{
  "status": "success",
  "message": "Complaint submitted",
  "data": {
    "id": "cmp_001",
    "orderId": "ord_xyz789",
    "customerId": "usr_abc123",
    "description": "Two shirts are missing and one jacket has a stain that wasn't there before.",
    "status": "OPEN",
    "createdAt": "2026-03-12T10:00:00.000Z"
  }
}
```

**Response (Error — 403):**

```json
{
  "status": "error",
  "message": "Complaints can only be filed for completed orders"
}
```

**Response (Error — 409):**

```json
{
  "status": "error",
  "message": "A complaint already exists for this order"
}
```

**Notes:**
- Complaints can only be filed when `Order.status === 'COMPLETED'`.
- One complaint per order — duplicate submissions are rejected with `409`.
- `description` is required and must be non-empty.

---

## GET /api/v1/complaints

List complaints with server-side pagination and filtering.

- **SUPER_ADMIN:** All complaints from all outlets.
- **OUTLET_ADMIN:** Complaints from their outlet's orders.
- **CUSTOMER:** Their own complaints only.

**Access:** `CUSTOMER`, `OUTLET_ADMIN`, `SUPER_ADMIN`

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | `1` | Page number |
| `limit` | number | `10` | Items per page |
| `status` | string | — | Filter by status: `OPEN`, `IN_REVIEW`, `RESOLVED` |
| `outletId` | string | — | Filter by outlet (SUPER_ADMIN only) |
| `sortBy` | string | `createdAt` | Sort field |
| `order` | string | `desc` | `asc` or `desc` |

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Complaints retrieved",
  "data": [
    {
      "id": "cmp_001",
      "orderId": "ord_xyz789",
      "customerName": "John Doe",
      "outletName": "PrimeCare Jakarta Selatan",
      "description": "Two shirts are missing and one jacket has a stain.",
      "status": "OPEN",
      "createdAt": "2026-03-12T10:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 2
  }
}
```

---

## GET /api/v1/complaints/:id

Get detailed information about a specific complaint.

**Access:** `CUSTOMER` (own complaint), `OUTLET_ADMIN` (own outlet), `SUPER_ADMIN`

**Path Params:**

| Param | Description |
|-------|-------------|
| `id` | Complaint UUID |

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Complaint retrieved",
  "data": {
    "id": "cmp_001",
    "orderId": "ord_xyz789",
    "customerId": "usr_abc123",
    "customerName": "John Doe",
    "outletName": "PrimeCare Jakarta Selatan",
    "description": "Two shirts are missing and one jacket has a stain that wasn't there before.",
    "status": "OPEN",
    "createdAt": "2026-03-12T10:00:00.000Z"
  }
}
```

**Response (Error — 404):**

```json
{
  "status": "error",
  "message": "Complaint not found"
}
```

---

## PATCH /api/v1/complaints/:id/status

Update the status of a complaint (admin review workflow).

**Access:** `OUTLET_ADMIN`, `SUPER_ADMIN`

**Path Params:**

| Param | Description |
|-------|-------------|
| `id` | Complaint UUID |

**Request Body:**

```json
{
  "status": "IN_REVIEW"
}
```

Valid status values: `IN_REVIEW`, `RESOLVED`

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Complaint status updated",
  "data": {
    "id": "cmp_001",
    "status": "IN_REVIEW",
    "updatedAt": "2026-03-13T09:00:00.000Z"
  }
}
```

**Response (Error — 422):**

```json
{
  "status": "error",
  "message": "Invalid status value"
}
```

**Notes:**
- Status transitions: `OPEN → IN_REVIEW → RESOLVED`.
- Outlet Admin can only update complaints linked to their outlet's orders.
- Customers cannot update complaint status — they can only view it.
