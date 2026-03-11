/*
  Warnings:

  - The values [SUPER_ADMIN,OUTLET_ADMIN,WORKER,DRIVER] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `item_name` on the `order_items` table. All the data in the column will be lost.
  - You are about to drop the column `admin_id` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `shifts` table. All the data in the column will be lost.
  - You are about to drop the column `item_name` on the `station_items` table. All the data in the column will be lost.
  - You are about to drop the column `worker_id` on the `station_records` table. All the data in the column will be lost.
  - You are about to drop the column `outlet_id` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `workerType` on the `users` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[order_id,station]` on the table `station_records` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `laundry_item_id` to the `order_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `staff_id` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `outlets` table without a default value. This is not possible if the table is not empty.
  - Added the required column `staff_id` to the `shifts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `laundry_item_id` to the `station_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `staff_id` to the `station_records` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('SUPER_ADMIN', 'OUTLET_ADMIN', 'WORKER', 'DRIVER');

-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('CUSTOMER');
ALTER TABLE "public"."users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'CUSTOMER';
COMMIT;

-- DropForeignKey
ALTER TABLE "bypass_requests" DROP CONSTRAINT "bypass_requests_admin_id_fkey";

-- DropForeignKey
ALTER TABLE "bypass_requests" DROP CONSTRAINT "bypass_requests_worker_id_fkey";

-- DropForeignKey
ALTER TABLE "deliveries" DROP CONSTRAINT "deliveries_driver_id_fkey";

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_admin_id_fkey";

-- DropForeignKey
ALTER TABLE "pickup_requests" DROP CONSTRAINT "pickup_requests_driver_id_fkey";

-- DropForeignKey
ALTER TABLE "shifts" DROP CONSTRAINT "shifts_user_id_fkey";

-- DropForeignKey
ALTER TABLE "station_records" DROP CONSTRAINT "station_records_worker_id_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_outlet_id_fkey";

-- DropIndex
DROP INDEX "orders_admin_id_idx";

-- DropIndex
DROP INDEX "orders_status_idx";

-- DropIndex
DROP INDEX "shifts_user_id_idx";

-- DropIndex
DROP INDEX "station_records_order_id_idx";

-- DropIndex
DROP INDEX "station_records_worker_id_idx";

-- DropIndex
DROP INDEX "users_outlet_id_idx";

-- AlterTable
ALTER TABLE "order_items" DROP COLUMN "item_name",
ADD COLUMN     "laundry_item_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "orders" DROP COLUMN "admin_id",
ADD COLUMN     "staff_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "outlets" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "shifts" DROP COLUMN "user_id",
ADD COLUMN     "staff_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "station_items" DROP COLUMN "item_name",
ADD COLUMN     "laundry_item_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "station_records" DROP COLUMN "worker_id",
ADD COLUMN     "staff_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "outlet_id",
DROP COLUMN "workerType";

-- CreateTable
CREATE TABLE "staff" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "outlet_id" TEXT,
    "role" "StaffRole" NOT NULL,
    "workerType" "StationType",
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "laundry_items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "laundry_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_user_id_key" ON "staff"("user_id");

-- CreateIndex
CREATE INDEX "staff_outlet_id_idx" ON "staff"("outlet_id");

-- CreateIndex
CREATE UNIQUE INDEX "laundry_items_name_key" ON "laundry_items"("name");

-- CreateIndex
CREATE UNIQUE INDEX "laundry_items_slug_key" ON "laundry_items"("slug");

-- CreateIndex
CREATE INDEX "orders_staff_id_idx" ON "orders"("staff_id");

-- CreateIndex
CREATE INDEX "orders_status_updated_at_idx" ON "orders"("status", "updated_at");

-- CreateIndex
CREATE INDEX "shifts_staff_id_idx" ON "shifts"("staff_id");

-- CreateIndex
CREATE INDEX "station_records_staff_id_idx" ON "station_records"("staff_id");

-- CreateIndex
CREATE UNIQUE INDEX "station_records_order_id_station_key" ON "station_records"("order_id", "station");

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_requests" ADD CONSTRAINT "pickup_requests_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_laundry_item_id_fkey" FOREIGN KEY ("laundry_item_id") REFERENCES "laundry_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "station_records" ADD CONSTRAINT "station_records_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "station_items" ADD CONSTRAINT "station_items_laundry_item_id_fkey" FOREIGN KEY ("laundry_item_id") REFERENCES "laundry_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bypass_requests" ADD CONSTRAINT "bypass_requests_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bypass_requests" ADD CONSTRAINT "bypass_requests_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
