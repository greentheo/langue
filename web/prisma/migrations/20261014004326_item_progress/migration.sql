-- CreateTable
CREATE TABLE "ItemProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "stage" INTEGER NOT NULL DEFAULT 0,
    "bestStage" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "intervalDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "right" INTEGER NOT NULL DEFAULT 0,
    "wrong" INTEGER NOT NULL DEFAULT 0,
    "rightStreak" INTEGER NOT NULL DEFAULT 0,
    "missStreak" INTEGER NOT NULL DEFAULT 0,
    "tricky" BOOLEAN NOT NULL DEFAULT false,
    "introducedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ItemProgress_userId_language_dueAt_idx" ON "ItemProgress"("userId", "language", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "ItemProgress_userId_itemKey_key" ON "ItemProgress"("userId", "itemKey");

-- AddForeignKey
ALTER TABLE "ItemProgress" ADD CONSTRAINT "ItemProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
