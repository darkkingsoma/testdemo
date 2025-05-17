/*
  Warnings:

  - You are about to alter the column `category` on the `MovieList` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(50)`.
  - You are about to alter the column `rating` on the `MovieList` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(50)`.
  - You are about to alter the column `votes` on the `MovieList` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(50)`.
  - You are about to alter the column `source` on the `MovieList` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(50)`.
  - A unique constraint covering the columns `[userId,movieId]` on the table `MovieList` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `MovieList` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `Comment` DROP FOREIGN KEY `Comment_userId_fkey`;

-- DropForeignKey
ALTER TABLE `MovieList` DROP FOREIGN KEY `MovieList_userId_fkey`;

-- AlterTable
ALTER TABLE `Comment` MODIFY `text` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `MovieList` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
    MODIFY `category` VARCHAR(50) NOT NULL,
    ALTER COLUMN `releaseDate` DROP DEFAULT,
    MODIFY `rating` VARCHAR(50) NOT NULL,
    MODIFY `votes` VARCHAR(50) NOT NULL,
    ALTER COLUMN `genreIds` DROP DEFAULT,
    MODIFY `source` VARCHAR(50) NOT NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `lastLoginAt` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `loginCount` INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX `MovieList_userId_movieId_key` ON `MovieList`(`userId`, `movieId`);

-- AddForeignKey
ALTER TABLE `MovieList` ADD CONSTRAINT `MovieList_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
