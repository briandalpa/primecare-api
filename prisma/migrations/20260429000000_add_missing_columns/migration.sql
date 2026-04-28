-- addresses.phone and pickup_requests.updated_at were added via prisma db push
-- and never captured in a migration file. This migration backfills them to
-- bring the production schema in sync with the Prisma model.

ALTER TABLE "addresses" ADD COLUMN "phone" TEXT NOT NULL DEFAULT '';
ALTER TABLE "addresses" ALTER COLUMN "phone" DROP DEFAULT;

ALTER TABLE "pickup_requests" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "pickup_requests" ALTER COLUMN "updated_at" DROP DEFAULT;
