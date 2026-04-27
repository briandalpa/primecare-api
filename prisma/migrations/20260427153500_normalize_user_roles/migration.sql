UPDATE "users"
SET "role" = 'CUSTOMER'
WHERE "role"::text <> 'CUSTOMER';
