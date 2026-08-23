-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('FEMALE', 'MALE', 'OTHER', 'NOT_SPECIFIED');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'STUDENT', 'SEASONAL');

-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'ON_LEAVE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "employeeNumber" TEXT,
ADD COLUMN     "photoKey" TEXT;

-- CreateTable
CREATE TABLE "EmployeeProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phoneEnc" TEXT,
    "dateOfBirthEnc" TEXT,
    "addressEnc" TEXT,
    "personalIdEnc" TEXT,
    "emergencyContactNameEnc" TEXT,
    "emergencyContactPhoneEnc" TEXT,
    "gender" "Gender",
    "employmentType" "EmploymentType",
    "notesEnc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeProfile_userId_key" ON "EmployeeProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeNumber_key" ON "User"("employeeNumber");

-- AddForeignKey
ALTER TABLE "EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

