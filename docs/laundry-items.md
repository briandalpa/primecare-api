# Laundry Items API Spec

Provides the master list of laundry item types. Used by the frontend to populate item selectors when outlet admins create orders and workers submit station quantities.

**Auth:** Requires a valid session cookie (`better-auth.session_token`).

**Response Envelope:**

```json
{ "status": "success" | "error", "message": "...", "data": { ... } | null }
```

> **Why this endpoint exists:** `OrderItem` and `StationItem` reference `LaundryItem` by UUID (`laundryItemId`), not by plain string. The frontend must fetch this list to build item dropdowns and map IDs to display names. 28 items are pre-seeded and managed server-side.

---

## GET /api/v1/laundry-items

List all active laundry item types. No pagination, the list is small and fixed (28 items).

**Access:** Any authenticated session (`requireAuth`) — all roles including `WORKER`, `DRIVER`, `CUSTOMER`

**Query Parameters:** None

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Laundry items retrieved",
  "data": [
    { "id": "uuid-tshirt", "name": "T-Shirt", "slug": "t-shirt" },
    { "id": "uuid-trousers", "name": "Trousers", "slug": "trousers" }
  ]
}
```

---

## GET /api/v1/admin/laundry-items

List all active laundry item types. No pagination, the list is small and fixed (28 items).

**Access:** `SUPER_ADMIN`, `OUTLET_ADMIN`

**Query Parameters:** None

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Laundry items retrieved",
  "data": [
    { "id": "uuid-tshirt", "name": "T-Shirt", "slug": "t-shirt" },
    { "id": "uuid-trousers", "name": "Trousers", "slug": "trousers" },
    { "id": "uuid-jacket", "name": "Jacket", "slug": "jacket" },
    { "id": "uuid-dress", "name": "Dress", "slug": "dress" }
  ]
}
```

**Notes:**

- Returns only items with `isActive: true`.
- Items are ordered alphabetically by name.
- Cache this list on the frontend, it changes very rarely.
- Workers can also access the item list via `GET /api/v1/laundry-items` (no admin role required). Item data for the current station is embedded in the `referenceItems` field returned by `GET /api/v1/worker/orders/:id`.

---

## Usage in Other Endpoints

When building item payloads for order creation or station processing, use `laundryItemId` from this list:

**Creating an order (`POST /api/v1/orders`):**

```json
{
  "items": [
    { "laundryItemId": "uuid-tshirt", "quantity": 5 },
    { "laundryItemId": "uuid-trousers", "quantity": 2 }
  ]
}
```

**Processing a station (`POST /api/v1/worker/orders/:id/process`):**

```json
{
  "items": [
    { "laundryItemId": "uuid-tshirt", "quantity": 5 },
    { "laundryItemId": "uuid-trousers", "quantity": 2 }
  ]
}
```

Responses from these endpoints return items with both `laundryItemId` and `itemName` (resolved from the join) for display purposes.
