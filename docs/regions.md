# Regions API Spec

Provides province/city lookup (via RajaOngkir) and address geocoding (via OpenCage) for building address forms and resolving coordinates.

**Auth:** All endpoints require a valid session cookie (`better-auth.session_token`) — any authenticated role.

**Response Envelope:**

```json
{ "status": "success" | "error", "message": "...", "data": { ... } | null }
```

---

## GET /api/v1/regions/provinces

List all available provinces.

**Access:** Any authenticated session (`requireAuth`)

**Query Parameters:** None

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Provinces retrieved",
  "data": [
    { "id": 11, "name": "Aceh" },
    { "id": 12, "name": "Sumatera Utara" }
  ]
}
```

**Notes:**

- Data sourced from RajaOngkir. Province IDs are integers and match the RajaOngkir API.
- Use `id` as `provinceId` for the `GET /regions/cities/:provinceId` endpoint.

---

## GET /api/v1/regions/cities/:provinceId

List all cities for a given province.

**Access:** Any authenticated session (`requireAuth`)

**Path Params:**

| Param        | Type    | Description             |
| ------------ | ------- | ----------------------- |
| `provinceId` | integer | Province ID (from provinces list) |

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Cities retrieved",
  "data": [
    { "id": 39, "name": "Kota Jakarta Selatan", "zipCode": "12110" },
    { "id": 40, "name": "Kota Jakarta Timur", "zipCode": "13210" }
  ]
}
```

**Response (Error — 422):**

```json
{
  "status": "error",
  "message": "Invalid province ID"
}
```

---

## GET /api/v1/regions/geocode

Convert a city and province name into geographic coordinates.

**Access:** Any authenticated session (`requireAuth`)

**Query Parameters:**

| Param      | Type   | Description          |
| ---------- | ------ | -------------------- |
| `city`     | string | City name (required) |
| `province` | string | Province name (required) |

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Geocode successful",
  "data": {
    "latitude": -6.2088,
    "longitude": 106.8456
  }
}
```

**Response (Error — 422):**

```json
{
  "status": "error",
  "message": "Unable to geocode the provided address"
}
```

**Notes:**

- Coordinates sourced from OpenCage. Used for populating `latitude`/`longitude` when creating or updating an address.

---

## GET /api/v1/regions/reverse-geocode

Convert latitude/longitude coordinates into a human-readable address.

**Access:** Any authenticated session (`requireAuth`)

**Query Parameters:**

| Param | Type   | Description                       |
| ----- | ------ | --------------------------------- |
| `lat` | number | Latitude (-90 to 90)              |
| `lng` | number | Longitude (-180 to 180)           |

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Reverse geocode successful",
  "data": {
    "province": "DKI Jakarta",
    "provinceId": 6,
    "city": "Kota Jakarta Selatan",
    "cityId": 39,
    "streetAddress": "Jl. Fatmawati No. 5"
  }
}
```

**Response (Error — 422):**

```json
{
  "status": "error",
  "message": "Unable to resolve coordinates"
}
```

**Notes:**

- `streetAddress` may be `null` if OpenCage cannot resolve a street-level address from the given coordinates.
- `provinceId` and `cityId` are matched against the RajaOngkir dataset.
