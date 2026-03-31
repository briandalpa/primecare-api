# Outlets API Spec

Manages laundry outlet branches. All endpoints are under `/api/v1/outlets`.

**Auth:** All endpoints require a valid session cookie (`better-auth.session_token`).

**Response Envelope:**

```json
{ "status": "success" | "error", "message": "...", "data": { ... } | null }
```

---

## GET /api/v1/outlets

List all outlets. Super Admin sees all; Outlet Admin sees only their own.

**Access:** `SUPER_ADMIN`, `OUTLET_ADMIN`

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | `1` | Page number |
| `limit` | number | `10` | Items per page |
| `search` | string | — | Search by outlet name |
| `isActive` | boolean | — | Filter by active status |
| `sortBy` | string | `createdAt` | Sort field |
| `order` | string | `desc` | `asc` or `desc` |

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Outlets retrieved",
  "data": [
    {
      "id": "out_001",
      "name": "PrimeCare Jakarta Selatan",
      "address": "Jl. Fatmawati No. 5",
      "city": "Jakarta",
      "province": "DKI Jakarta",
      "latitude": -6.2615,
      "longitude": 106.7942,
      "maxServiceRadiusKm": 10.0,
      "isActive": true,
      "createdAt": "2026-01-01T00:00:00.000Z"
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

## POST /api/v1/outlets

Create a new outlet branch.

**Access:** `SUPER_ADMIN`

**Request Body:**

```json
{
  "name": "PrimeCare Bandung",
  "address": "Jl. Asia Afrika No. 1",
  "city": "Bandung",
  "province": "Jawa Barat",
  "latitude": -6.9175,
  "longitude": 107.6191,
  "maxServiceRadiusKm": 10.0
}
```

**Response (Success — 201):**

```json
{
  "status": "success",
  "message": "Outlet created",
  "data": {
    "id": "out_002",
    "name": "PrimeCare Bandung",
    "address": "Jl. Asia Afrika No. 1",
    "city": "Bandung",
    "province": "Jawa Barat",
    "latitude": -6.9175,
    "longitude": 107.6191,
    "maxServiceRadiusKm": 10.0,
    "isActive": true,
    "createdAt": "2026-03-06T10:00:00.000Z"
  }
}
```

**Notes:**
- `latitude` and `longitude` are required and used for nearest-outlet calculation (Haversine).
- `maxServiceRadiusKm` defaults to `10.0` if not provided.

---

## GET /api/v1/outlets/:id

Get details of a specific outlet.

**Access:** `SUPER_ADMIN`, `OUTLET_ADMIN` (own outlet only)

**Path Params:**

| Param | Description |
|-------|-------------|
| `id` | Outlet UUID |

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Outlet retrieved",
  "data": {
    "id": "out_001",
    "name": "PrimeCare Jakarta Selatan",
    "address": "Jl. Fatmawati No. 5",
    "city": "Jakarta",
    "province": "DKI Jakarta",
    "latitude": -6.2615,
    "longitude": 106.7942,
    "maxServiceRadiusKm": 10.0,
    "isActive": true,
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

**Response (Error — 404):**

```json
{
  "status": "error",
  "message": "Outlet not found"
}
```

---

## PATCH /api/v1/outlets/:id

Update outlet details.

**Access:** `SUPER_ADMIN`

**Path Params:**

| Param | Description |
|-------|-------------|
| `id` | Outlet UUID |

**Request Body:**

```json
{
  "name": "PrimeCare Jakarta Selatan (Fatmawati)",
  "maxServiceRadiusKm": 15.0,
  "isActive": true
}
```

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Outlet updated",
  "data": {
    "id": "out_001",
    "name": "PrimeCare Jakarta Selatan (Fatmawati)",
    "maxServiceRadiusKm": 15.0,
    "isActive": true,
    "address": "Jl. Fatmawati No. 5",
    "city": "Jakarta",
    "province": "DKI Jakarta",
    "latitude": -6.2615,
    "longitude": 106.7942
  }
}
```

---

## DELETE /api/v1/outlets/:id

Deactivate an outlet (soft-delete via `isActive: false`).

**Access:** `SUPER_ADMIN`

**Path Params:**

| Param | Description |
|-------|-------------|
| `id` | Outlet UUID |

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Outlet deactivated",
  "data": null
}
```

**Response (Error — 404):**

```json
{
  "status": "error",
  "message": "Outlet not found"
}
```

**Notes:**
- Outlets are never hard-deleted. Setting `isActive: false` excludes the outlet from nearest-outlet calculations.
- Always confirm in the UI before calling this endpoint.
