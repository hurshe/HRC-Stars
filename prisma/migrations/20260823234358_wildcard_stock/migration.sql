-- CreateTable
CREATE TABLE "WildCardStock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WildCardStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WildCardAllocation" (
    "id" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "allocatedById" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" TEXT,
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WildCardAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WildCardStock_userId_key" ON "WildCardStock"("userId");

-- CreateIndex
CREATE INDEX "WildCardAllocation_stockId_idx" ON "WildCardAllocation"("stockId");

-- AddForeignKey
ALTER TABLE "WildCardStock" ADD CONSTRAINT "WildCardStock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WildCardAllocation" ADD CONSTRAINT "WildCardAllocation_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "WildCardStock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WildCardAllocation" ADD CONSTRAINT "WildCardAllocation_allocatedById_fkey" FOREIGN KEY ("allocatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

