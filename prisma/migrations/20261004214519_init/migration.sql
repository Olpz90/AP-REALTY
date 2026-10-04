-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGING_BROKER', 'AGENT');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('ONBOARDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SplitTier" AS ENUM ('TIER_INCUBATOR_70_30', 'TIER_ASSOCIATE_80_20', 'TIER_STANDARD_85_15', 'TIER_PRESTIGE_90_10');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('COMING_SOON', 'ACTIVE', 'PENDING_ESCROW', 'CLOSED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Representation" AS ENUM ('SELLER', 'BUYER', 'DUAL');

-- CreateEnum
CREATE TYPE "ContingencyType" AS ENUM ('INSPECTION', 'APPRAISAL', 'LOAN', 'OTHER');

-- CreateEnum
CREATE TYPE "OnboardingStep" AS ENUM ('W9_AND_BROKER_AGREEMENT', 'IDFPR_SPONSORSHIP_TRANSFER', 'MLS_BOARD_ACCESS', 'SUPRA_EKEY', 'CRM_PROVISIONING', 'MENTOR_ASSIGNMENT');

-- CreateEnum
CREATE TYPE "StepStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'AWAITING_EXTERNAL', 'BLOCKED', 'COMPLETE');

-- CreateEnum
CREATE TYPE "LicenseType" AS ENUM ('MANAGING_BROKER', 'BROKER');

-- CreateEnum
CREATE TYPE "ComplianceScope" AS ENUM ('BROKERAGE', 'LICENSEE');

-- CreateEnum
CREATE TYPE "ComplianceFrequency" AS ENUM ('ANNUAL', 'RENEWAL_YEAR');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETE', 'NOT_APPLICABLE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "authProviderId" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'AGENT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "licenseType" "LicenseType" NOT NULL DEFAULT 'BROKER',
    "licenseExpiresAt" TIMESTAMP(3),
    "title" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "status" "AgentStatus" NOT NULL DEFAULT 'ONBOARDING',
    "splitTier" "SplitTier" NOT NULL DEFAULT 'TIER_INCUBATOR_70_30',
    "mentorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingRecord" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "backgroundCheckClearedAt" TIMESTAMP(3),
    "targetGraduationDate" TIMESTAMP(3),
    "graduatedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingStepProgress" (
    "id" TEXT NOT NULL,
    "onboardingRecordId" TEXT NOT NULL,
    "step" "OnboardingStep" NOT NULL,
    "status" "StepStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "blockerNote" TEXT,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingStepProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "mlsNumber" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'IL',
    "zipCode" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'COMING_SOON',
    "bedrooms" INTEGER NOT NULL,
    "bathrooms" DECIMAL(3,1) NOT NULL,
    "squareFeet" INTEGER NOT NULL,
    "listedAt" TIMESTAMP(3),
    "offMarketAt" TIMESTAMP(3),
    "showingCount" INTEGER NOT NULL DEFAULT 0,
    "offerCount" INTEGER NOT NULL DEFAULT 0,
    "primaryAgentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingPhoto" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ListingPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'OPEN',
    "escrowNumber" TEXT NOT NULL,
    "escrowCompany" TEXT NOT NULL,
    "finalAgreedPrice" DECIMAL(12,2) NOT NULL,
    "grossCommissionPercent" DECIMAL(5,3) NOT NULL,
    "escrowStartDate" TIMESTAMP(3) NOT NULL,
    "targetClosingDate" TIMESTAMP(3) NOT NULL,
    "actualClosingDate" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "hud1AuditedAt" TIMESTAMP(3),
    "hud1AuditedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contingency" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "type" "ContingencyType" NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "Contingency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionAgent" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "representation" "Representation" NOT NULL,
    "splitPercent" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "TransactionAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionRecord" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "grossCommission" DECIMAL(12,2) NOT NULL,
    "agentSplitPercent" DECIMAL(5,2) NOT NULL,
    "brokerageCompanyCut" DECIMAL(12,2) NOT NULL,
    "agentNetPayout" DECIMAL(12,2) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerageAnnualGoal" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "volumeGoal" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "BrokerageAnnualGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerageMonthlyTarget" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "targetVolume" DECIMAL(14,2) NOT NULL,
    "mlsBenchmarkDom" INTEGER,

    CONSTRAINT "BrokerageMonthlyTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceRequirement" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "scope" "ComplianceScope" NOT NULL,
    "frequency" "ComplianceFrequency" NOT NULL,
    "licenseTypes" "LicenseType"[],
    "dueMonth" INTEGER NOT NULL,
    "dueDay" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ComplianceRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceItem" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "requirementId" TEXT NOT NULL,
    "agentId" TEXT,
    "status" "ComplianceStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_authProviderId_key" ON "User"("authProviderId");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_userId_key" ON "Agent"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_email_key" ON "Agent"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_licenseNumber_key" ON "Agent"("licenseNumber");

-- CreateIndex
CREATE INDEX "Agent_status_idx" ON "Agent"("status");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingRecord_agentId_key" ON "OnboardingRecord"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingStepProgress_onboardingRecordId_step_key" ON "OnboardingStepProgress"("onboardingRecordId", "step");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_mlsNumber_key" ON "Listing"("mlsNumber");

-- CreateIndex
CREATE INDEX "Listing_status_idx" ON "Listing"("status");

-- CreateIndex
CREATE INDEX "Listing_primaryAgentId_idx" ON "Listing"("primaryAgentId");

-- CreateIndex
CREATE INDEX "ListingPhoto_listingId_sortOrder_idx" ON "ListingPhoto"("listingId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_escrowNumber_key" ON "Transaction"("escrowNumber");

-- CreateIndex
CREATE INDEX "Transaction_listingId_idx" ON "Transaction"("listingId");

-- CreateIndex
CREATE INDEX "Transaction_status_targetClosingDate_idx" ON "Transaction"("status", "targetClosingDate");

-- CreateIndex
CREATE INDEX "Transaction_status_actualClosingDate_idx" ON "Transaction"("status", "actualClosingDate");

-- CreateIndex
CREATE INDEX "Contingency_transactionId_deadline_idx" ON "Contingency"("transactionId", "deadline");

-- CreateIndex
CREATE INDEX "TransactionAgent_agentId_idx" ON "TransactionAgent"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionAgent_transactionId_agentId_key" ON "TransactionAgent"("transactionId", "agentId");

-- CreateIndex
CREATE INDEX "CommissionRecord_agentId_paidAt_idx" ON "CommissionRecord"("agentId", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionRecord_transactionId_agentId_key" ON "CommissionRecord"("transactionId", "agentId");

-- CreateIndex
CREATE UNIQUE INDEX "BrokerageAnnualGoal_year_key" ON "BrokerageAnnualGoal"("year");

-- CreateIndex
CREATE UNIQUE INDEX "BrokerageMonthlyTarget_year_month_key" ON "BrokerageMonthlyTarget"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceRequirement_code_key" ON "ComplianceRequirement"("code");

-- CreateIndex
CREATE INDEX "ComplianceItem_year_status_idx" ON "ComplianceItem"("year", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceItem_year_requirementId_agentId_key" ON "ComplianceItem"("year", "requirementId", "agentId");

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingRecord" ADD CONSTRAINT "OnboardingRecord_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingStepProgress" ADD CONSTRAINT "OnboardingStepProgress_onboardingRecordId_fkey" FOREIGN KEY ("onboardingRecordId") REFERENCES "OnboardingRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_primaryAgentId_fkey" FOREIGN KEY ("primaryAgentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingPhoto" ADD CONSTRAINT "ListingPhoto_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_hud1AuditedById_fkey" FOREIGN KEY ("hud1AuditedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contingency" ADD CONSTRAINT "Contingency_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionAgent" ADD CONSTRAINT "TransactionAgent_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionAgent" ADD CONSTRAINT "TransactionAgent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRecord" ADD CONSTRAINT "CommissionRecord_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRecord" ADD CONSTRAINT "CommissionRecord_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRecord" ADD CONSTRAINT "CommissionRecord_transactionId_agentId_fkey" FOREIGN KEY ("transactionId", "agentId") REFERENCES "TransactionAgent"("transactionId", "agentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRecord" ADD CONSTRAINT "CommissionRecord_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceItem" ADD CONSTRAINT "ComplianceItem_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "ComplianceRequirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceItem" ADD CONSTRAINT "ComplianceItem_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceItem" ADD CONSTRAINT "ComplianceItem_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Only one open escrow per listing (Prisma can't express partial indexes).
CREATE UNIQUE INDEX "Transaction_one_open_per_listing" ON "Transaction"("listingId") WHERE status = 'OPEN';

-- One brokerage-level compliance row per requirement per year (agentId is null).
CREATE UNIQUE INDEX "ComplianceItem_brokerage_unique" ON "ComplianceItem"("year", "requirementId") WHERE "agentId" IS NULL;
