-- CreateTable
CREATE TABLE "CreditPurchase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "packSize" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "pfPaymentId" TEXT,
    "status" TEXT NOT NULL,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ProcessedPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pfPaymentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LoginToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_LoginToken" ("createdAt", "email", "expiresAt", "id", "token", "used") SELECT "createdAt", "email", "expiresAt", "id", "token", "used" FROM "LoginToken";
DROP TABLE "LoginToken";
ALTER TABLE "new_LoginToken" RENAME TO "LoginToken";
CREATE UNIQUE INDEX "LoginToken_token_key" ON "LoginToken"("token");
CREATE TABLE "new_Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payfastToken" TEXT,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "monthlyCredits" INTEGER NOT NULL DEFAULT 0,
    "imagesUsed" INTEGER NOT NULL DEFAULT 0,
    "imagesLimit" INTEGER NOT NULL DEFAULT 50,
    "startedAt" DATETIME,
    "nextBilling" DATETIME,
    "lastReset" DATETIME,
    "paymentFailedAt" DATETIME,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Subscription" ("createdAt", "id", "nextBilling", "payfastToken", "startedAt", "status", "tier", "updatedAt", "userId") SELECT "createdAt", "id", "nextBilling", "payfastToken", "startedAt", "status", "tier", "updatedAt", "userId" FROM "Subscription";
DROP TABLE "Subscription";
ALTER TABLE "new_Subscription" RENAME TO "Subscription";
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedPayment_pfPaymentId_key" ON "ProcessedPayment"("pfPaymentId");
