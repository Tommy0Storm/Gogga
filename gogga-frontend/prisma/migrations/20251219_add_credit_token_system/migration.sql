-- CreateTable
CREATE TABLE "DebugSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "reason" TEXT NOT NULL,
    "consoleLogs" TEXT NOT NULL,
    "networkLogs" TEXT,
    "errorStack" TEXT,
    "userAgent" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "screenSize" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "adminNotes" TEXT,
    "resolvedAt" DATETIME,
    "resolvedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DebugSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecurringSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'monthly',
    "nextChargeAt" DATETIME NOT NULL,
    "lastChargedAt" DATETIME,
    "chargeCount" INTEGER NOT NULL DEFAULT 0,
    "maxCharges" INTEGER NOT NULL DEFAULT 12,
    "status" TEXT NOT NULL DEFAULT 'active',
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Usage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "adjustedCompletionTokens" INTEGER,
    "reasoningTokens" INTEGER,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "optillmLevel" TEXT,
    "optillmMultiplier" REAL,
    "conversationId" TEXT,
    "requestId" TEXT,
    "durationMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UsageSummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalCostCents" INTEGER NOT NULL DEFAULT 0,
    "chatRequests" INTEGER NOT NULL DEFAULT 0,
    "enhanceRequests" INTEGER NOT NULL DEFAULT 0,
    "imageRequests" INTEGER NOT NULL DEFAULT 0,
    "imagesUsed" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UsageSummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ModelPricing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "inputPricePerM" REAL NOT NULL DEFAULT 0,
    "outputPricePerM" REAL NOT NULL DEFAULT 0,
    "imagePricePerUnit" REAL NOT NULL DEFAULT 0,
    "allowedTiers" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FeatureCost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "featureKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "costType" TEXT NOT NULL,
    "costAmountUSD" REAL NOT NULL DEFAULT 0,
    "tierOverrides" TEXT,
    "cepoMultiplier" REAL NOT NULL DEFAULT 1.0,
    "isBillable" BOOLEAN NOT NULL DEFAULT true,
    "updatedBy" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL,
    "rate" REAL NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PricingAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tableName" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousValues" TEXT,
    "newValues" TEXT,
    "changedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CreditAdjustment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "adjustmentType" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "adminEmail" TEXT,
    "adminIp" TEXT,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreditAdjustment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "creditsDeducted" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT,
    "provider" TEXT,
    "tier" TEXT NOT NULL,
    "requestId" TEXT,
    "durationMs" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "refundedAt" DATETIME,
    "refundReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isServiceAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isTester" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "creditBalance" INTEGER NOT NULL DEFAULT 0,
    "usageChatTokens" INTEGER NOT NULL DEFAULT 0,
    "usageImages" INTEGER NOT NULL DEFAULT 0,
    "usageImageEdits" INTEGER NOT NULL DEFAULT 0,
    "usageUpscales" INTEGER NOT NULL DEFAULT 0,
    "usageVideoSeconds" INTEGER NOT NULL DEFAULT 0,
    "usageGoggaTalkMins" REAL NOT NULL DEFAULT 0,
    "usageResetDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("createdAt", "email", "id", "isAdmin", "isServiceAdmin", "updatedAt") SELECT "createdAt", "email", "id", "isAdmin", "isServiceAdmin", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "DebugSubmission_createdAt_idx" ON "DebugSubmission"("createdAt");

-- CreateIndex
CREATE INDEX "DebugSubmission_status_idx" ON "DebugSubmission"("status");

-- CreateIndex
CREATE INDEX "DebugSubmission_userId_idx" ON "DebugSubmission"("userId");

-- CreateIndex
CREATE INDEX "RecurringSchedule_status_idx" ON "RecurringSchedule"("status");

-- CreateIndex
CREATE INDEX "RecurringSchedule_nextChargeAt_idx" ON "RecurringSchedule"("nextChargeAt");

-- CreateIndex
CREATE INDEX "RecurringSchedule_userId_idx" ON "RecurringSchedule"("userId");

-- CreateIndex
CREATE INDEX "Usage_endpoint_idx" ON "Usage"("endpoint");

-- CreateIndex
CREATE INDEX "Usage_model_idx" ON "Usage"("model");

-- CreateIndex
CREATE INDEX "Usage_createdAt_idx" ON "Usage"("createdAt");

-- CreateIndex
CREATE INDEX "Usage_userId_createdAt_idx" ON "Usage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Usage_userId_idx" ON "Usage"("userId");

-- CreateIndex
CREATE INDEX "UsageSummary_year_month_idx" ON "UsageSummary"("year", "month");

-- CreateIndex
CREATE INDEX "UsageSummary_userId_idx" ON "UsageSummary"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UsageSummary_userId_year_month_key" ON "UsageSummary"("userId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "ModelPricing_modelId_key" ON "ModelPricing"("modelId");

-- CreateIndex
CREATE INDEX "ModelPricing_provider_idx" ON "ModelPricing"("provider");

-- CreateIndex
CREATE INDEX "ModelPricing_isActive_idx" ON "ModelPricing"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureCost_featureKey_key" ON "FeatureCost"("featureKey");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_fromCurrency_toCurrency_key" ON "ExchangeRate"("fromCurrency", "toCurrency");

-- CreateIndex
CREATE INDEX "PricingAudit_tableName_idx" ON "PricingAudit"("tableName");

-- CreateIndex
CREATE INDEX "PricingAudit_recordId_idx" ON "PricingAudit"("recordId");

-- CreateIndex
CREATE INDEX "PricingAudit_createdAt_idx" ON "PricingAudit"("createdAt");

-- CreateIndex
CREATE INDEX "CreditAdjustment_userId_idx" ON "CreditAdjustment"("userId");

-- CreateIndex
CREATE INDEX "CreditAdjustment_adminEmail_idx" ON "CreditAdjustment"("adminEmail");

-- CreateIndex
CREATE INDEX "CreditAdjustment_adjustmentType_idx" ON "CreditAdjustment"("adjustmentType");

-- CreateIndex
CREATE INDEX "CreditAdjustment_createdAt_idx" ON "CreditAdjustment"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UsageEvent_idempotencyKey_key" ON "UsageEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "UsageEvent_userId_idx" ON "UsageEvent"("userId");

-- CreateIndex
CREATE INDEX "UsageEvent_actionType_idx" ON "UsageEvent"("actionType");

-- CreateIndex
CREATE INDEX "UsageEvent_source_idx" ON "UsageEvent"("source");

-- CreateIndex
CREATE INDEX "UsageEvent_createdAt_idx" ON "UsageEvent"("createdAt");

-- CreateIndex
CREATE INDEX "UsageEvent_status_idx" ON "UsageEvent"("status");

