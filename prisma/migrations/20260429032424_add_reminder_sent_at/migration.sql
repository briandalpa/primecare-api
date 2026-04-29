-- AlterTable
ALTER TABLE "complaints" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "reminder_sent_at" TIMESTAMP(3);
