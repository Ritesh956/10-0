/*
  Warnings:

  - Added the required column `mentality` to the `ref_managers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `passingStyle` to the `ref_managers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pressing` to the `ref_managers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tempo` to the `ref_managers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `width` to the `ref_managers` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ref_managers" ADD COLUMN     "managerPhilosophy" TEXT,
ADD COLUMN     "mentality" TEXT NOT NULL,
ADD COLUMN     "passingStyle" TEXT NOT NULL,
ADD COLUMN     "pressing" TEXT NOT NULL,
ADD COLUMN     "tempo" TEXT NOT NULL,
ADD COLUMN     "width" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "world_clubs" ADD COLUMN     "refManagerId" TEXT;

-- AddForeignKey
ALTER TABLE "world_clubs" ADD CONSTRAINT "world_clubs_refManagerId_fkey" FOREIGN KEY ("refManagerId") REFERENCES "ref_managers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
