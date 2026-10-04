# Ap Realty Group Inc. — Database Architecture & Data Models Guide (v2)

This document lists the data structures (models) behind the **Ap Realty Group Inc.** brokerage management app. Each model is first explained in plain language for non-technical leadership, then defined in an implementation-ready schema.

> **What changed from v1:** see Section 5 at the end. In short, v2 handles co-listed payouts, deals that fall out of escrow, and logins/permissions. It also stops storing countdowns and percentages that would go out of date.

---

## 1. Why Data Models Matter: The Filing Cabinet Analogy

Think of a software application like an automated luxury brokerage office:
- **Screens & Buttons (Frontend):** The front lobby, presentation boards, and mobile app screens you tap on.
- **The Code / Logic (Backend):** The office administrator who processes paperwork and updates ledgers.
- **Data Models (Database):** The precision filing cabinet. Every folder follows a standard template, so nothing gets lost, numbers add up reliably, and nobody sees commission splits or personal documents they shouldn't.

The 4 screens (Dashboard, Listings, Roster, Onboarding Tracker) run on **6 core models** plus a few small supporting tables, and a **User** model that controls who can log in and what they can see.

**A guiding rule in v2: store facts, calculate the rest.** The database records things that happened, with dates (e.g. "listed on Sept 3", "inspection deadline Oct 6 at 5pm"). Numbers like "21 Days on Market", "Day 12 of escrow", "48 hours left" and "85% onboarded" are calculated from those facts whenever a screen loads. That way they are always correct, and no background job has to keep them up to date.

---

## 2. Plain-English Breakdown of Every Model

### 0. `User` (Login & Permissions)
* **Why it's needed:** Agents must not see each other's commission splits or payouts.
* **What it stores:** Login email, a link to the sign-in provider, and a **role**: `MANAGING_BROKER` (sees everything, approves payouts), `ADMIN` (office staff / transaction coordinator), or `AGENT` (sees only their own deals and money).
* **Where you see it:** Behind the scenes on every screen; it decides what each person is allowed to see.

### 1. `Agent` (The People Model)
* **Why it's needed:** Commissions, listings and onboarding can't be tracked without knowing who your agents are.
* **What it stores:** Full name, contact details, CalDRE license number and expiry, display title, status, **current** commission split tier (e.g. 90/10), and mentor relationship.
* **Where you see it:** **Agent Roster**, the agent assigned to each property on **Listings**, and the **Header** profile.

### 2. `OnboardingRecord` + `OnboardingStepProgress` (The New Recruit Tracker)
* **Why it's needed:** Each recruit goes through a 6-step journey: W-9 & broker agreement, State DRE license transfer, MLS board access, Supra eKey, CRM setup, and mentor assignment.
* **What it stores:** One record per recruit (background check, target graduation date, notes), plus **one row per step** with its own status (*Not started / In progress / Awaiting external / Blocked / Complete*) and a blocker note (e.g. "Awaiting State DRE approval").
* **Why one row per step:** Adding a step later (e.g. headshots, first-transaction shadowing) means adding a value, not redesigning the table. The percentage and "current step" are worked out from the rows, so they always match what is actually done.
* **Where you see it:** **Agent Onboarding Tracker**.

### 3. `Listing` + `ListingPhoto` (The Property Inventory)
* **What it stores:** Address, list price, status (`Coming Soon`, `Active`, `Pending/Escrow`, `Closed`, `Withdrawn`), beds/baths/sq ft, showing and offer counts, the primary listing agent, the **date it went on market** (Days on Market is calculated from it), and any number of ordered photos.
* **Where you see it:** **Listings & Pipeline** and the featured card on the **Dashboard**.

### 4. `Transaction` + `Contingency` + `TransactionAgent` (The Pipeline & Escrows)
* **Why it's needed:** A listing is marketing; an escrow is real money.
* **What it stores:** A deal **status** (`Open` / `Closed` / `Cancelled`), agreed price, commission %, escrow company and number, escrow start date, target and actual closing dates, and who audited the HUD-1 settlement and when.
* **Contingencies:** One row per deadline (inspection, appraisal, loan), each with an exact date/time. The "48 hours left" badge is simply *deadline minus now*.
* **Agents on the deal:** Each agent's role (Seller / Buyer / Dual side) and their share (100% solo, 50/50 co-listed).
* **Fall-throughs:** If an escrow cancels, it stays on record as `Cancelled` and the same home can open a new escrow. The database allows only **one open escrow per home at a time**.
* **Where you see it:** **Dashboard Under Contract counter** and **Listings Escrow Badges**.

### 5. `CommissionRecord` (The Revenue & Splits Ledger)
* **What it stores:** **One payout row per agent per deal.** Each row holds that agent's gross commission, the split % **in effect at the time of the deal**, the house cut, the agent's net payout, who approved it and when, and when it was paid.
* **Why the split is saved on each payout:** If Marcus moves from 85/15 to 90/10 next year, his past payouts stay exactly as they were paid.
* **Safety rail:** The database won't create a payout for an agent who isn't on that deal.
* **Where you see it:** **Executive KPIs** and **Leaderboard earnings**.

### 6. `BrokerageAnnualGoal` + `BrokerageMonthlyTarget` (The Executive Pacing)
* **What it stores:** Only the numbers leadership **sets** or gets from outside sources: the annual goal (e.g. $60M), each month's target (e.g. September $8.50M), and the regional MLS Days-on-Market benchmark (e.g. 34).
* **What it doesn't store:** "Current pacing", "projected volume" and "days remaining" are calculated live from closed deals and the calendar, so they never go stale.
* **Where you see it:** The pacing bar and benchmarks on the **Executive Dashboard**.

---

## 3. Production Database Schema (Prisma / PostgreSQL)

An engineer can drop this into a PostgreSQL + Prisma project (Prisma 5). It has been checked with `prisma validate` and applied to a real PostgreSQL 16 database.

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ───────────── ENUMS ─────────────

enum UserRole {
  ADMIN // office staff / transaction coordinator
  MANAGING_BROKER // sees everything, approves commissions
  AGENT // sees own deals and own payouts only
}

enum AgentStatus {
  ONBOARDING
  ACTIVE
  INACTIVE
  SUSPENDED
}

enum SplitTier {
  TIER_INCUBATOR_70_30 // 70% Agent / 30% House
  TIER_ASSOCIATE_80_20 // 80% Agent / 20% House
  TIER_STANDARD_85_15 // 85% Agent / 15% House
  TIER_PRESTIGE_90_10 // 90% Agent / 10% House
}

enum ListingStatus {
  COMING_SOON
  ACTIVE
  PENDING_ESCROW
  CLOSED
  WITHDRAWN
}

enum TransactionStatus {
  OPEN // in escrow / under contract
  CLOSED // funded and recorded
  CANCELLED // fell out of escrow
}

enum Representation {
  SELLER
  BUYER
  DUAL
}

enum ContingencyType {
  INSPECTION
  APPRAISAL
  LOAN
  OTHER
}

enum OnboardingStep {
  W9_AND_BROKER_AGREEMENT
  STATE_DRE_LICENSE_TRANSFER
  MLS_BOARD_ACCESS
  SUPRA_EKEY
  CRM_PROVISIONING
  MENTOR_ASSIGNMENT
}

enum StepStatus {
  NOT_STARTED
  IN_PROGRESS
  AWAITING_EXTERNAL // e.g. waiting on the State DRE
  BLOCKED
  COMPLETE
}

// ───────────── 0. LOGIN & PERMISSIONS ─────────────

model User {
  id                  String             @id @default(uuid())
  email               String             @unique
  authProviderId      String?            @unique // id from Auth0 / Clerk / Supabase Auth, etc.
  role                UserRole           @default(AGENT)
  isActive            Boolean            @default(true)
  agent               Agent?
  approvedCommissions CommissionRecord[] @relation("CommissionApprover")
  auditedTransactions Transaction[]      @relation("Hud1Auditor")
  createdAt           DateTime           @default(now())
}

// ───────────── 1. AGENT ─────────────

model Agent {
  id               String      @id @default(uuid())
  userId           String?     @unique
  user             User?       @relation(fields: [userId], references: [id])
  firstName        String
  lastName         String
  email            String      @unique
  phone            String
  licenseNumber    String      @unique // e.g. CalDRE #0219488
  licenseExpiresAt DateTime?
  title            String // display title, e.g. "Senior Managing Associate"
  avatarUrl        String?
  status           AgentStatus @default(ONBOARDING)
  splitTier        SplitTier   @default(TIER_INCUBATOR_70_30) // current tier; past payouts keep their own snapshot
  mentorId         String?
  mentor           Agent?      @relation("Mentorship", fields: [mentorId], references: [id])
  mentees          Agent[]     @relation("Mentorship")

  listings          Listing[]
  transactions      TransactionAgent[]
  onboardingRecord  OnboardingRecord?
  commissionPayouts CommissionRecord[]
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt

  @@index([status])
}

// ───────────── 2. ONBOARDING ─────────────

model OnboardingRecord {
  id                       String                   @id @default(uuid())
  agentId                  String                   @unique
  agent                    Agent                    @relation(fields: [agentId], references: [id], onDelete: Cascade)
  backgroundCheckClearedAt DateTime?
  targetGraduationDate     DateTime?
  graduatedAt              DateTime?
  notes                    String?
  steps                    OnboardingStepProgress[]
  createdAt                DateTime                 @default(now())
  updatedAt                DateTime                 @updatedAt
}

// One row per step per recruit. Progress % and "current step" are calculated from these rows.
model OnboardingStepProgress {
  id                 String           @id @default(uuid())
  onboardingRecordId String
  onboardingRecord   OnboardingRecord @relation(fields: [onboardingRecordId], references: [id], onDelete: Cascade)
  step               OnboardingStep
  status             StepStatus       @default(NOT_STARTED)
  blockerNote        String? // e.g. "Awaiting State DRE approval"
  completedAt        DateTime?
  updatedAt          DateTime         @updatedAt

  @@unique([onboardingRecordId, step])
}

// ───────────── 3. LISTING ─────────────

model Listing {
  id             String         @id @default(uuid())
  mlsNumber      String         @unique // e.g. MLS #24-9182
  address        String // e.g. "742 Evergreen Terrace"
  city           String
  state          String         @default("CA")
  zipCode        String
  price          Decimal        @db.Decimal(12, 2) // e.g. 3850000.00
  status         ListingStatus  @default(COMING_SOON)
  bedrooms       Int
  bathrooms      Decimal        @db.Decimal(3, 1) // e.g. 6.5
  squareFeet     Int
  listedAt       DateTime? // went ACTIVE on MLS; Days on Market counts from here
  offMarketAt    DateTime? // went pending/closed/withdrawn; stops the DOM clock
  showingCount   Int            @default(0)
  offerCount     Int            @default(0)
  primaryAgentId String
  primaryAgent   Agent          @relation(fields: [primaryAgentId], references: [id])
  photos         ListingPhoto[]
  transactions   Transaction[] // a listing can have a cancelled escrow, then a new one
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  @@index([status])
  @@index([primaryAgentId])
}

model ListingPhoto {
  id        String  @id @default(uuid())
  listingId String
  listing   Listing @relation(fields: [listingId], references: [id], onDelete: Cascade)
  url       String
  caption   String?
  sortOrder Int     @default(0) // 0 = cover photo

  @@index([listingId, sortOrder])
}

// ───────────── 4. TRANSACTION / ESCROW ─────────────

model Transaction {
  id                     String             @id @default(uuid())
  listingId              String
  listing                Listing            @relation(fields: [listingId], references: [id])
  status                 TransactionStatus  @default(OPEN)
  escrowNumber           String             @unique
  escrowCompany          String
  finalAgreedPrice       Decimal            @db.Decimal(12, 2)
  grossCommissionPercent Decimal            @db.Decimal(5, 3) // e.g. 3.000 (%) for our side(s)
  escrowStartDate        DateTime
  targetClosingDate      DateTime
  actualClosingDate      DateTime?
  cancelledAt            DateTime?
  hud1AuditedAt          DateTime?
  hud1AuditedById        String?
  hud1AuditedBy          User?              @relation("Hud1Auditor", fields: [hud1AuditedById], references: [id])
  contingencies          Contingency[]
  agents                 TransactionAgent[]
  commissionRecords      CommissionRecord[]
  createdAt              DateTime           @default(now())
  updatedAt              DateTime           @updatedAt

  @@index([listingId])
  @@index([status, targetClosingDate])
  @@index([status, actualClosingDate])
}

// Deadlines drive the "48h inspection" countdowns; nothing to keep ticking.
model Contingency {
  id            String          @id @default(uuid())
  transactionId String
  transaction   Transaction     @relation(fields: [transactionId], references: [id], onDelete: Cascade)
  type          ContingencyType
  deadline      DateTime
  removedAt     DateTime? // contingency satisfied / waived

  @@index([transactionId, deadline])
}

// Who worked the deal and what share of our side each agent gets (co-listing, dual agency).
model TransactionAgent {
  id             String            @id @default(uuid())
  transactionId  String
  agentId        String
  transaction    Transaction       @relation(fields: [transactionId], references: [id], onDelete: Cascade)
  agent          Agent             @relation(fields: [agentId], references: [id])
  representation Representation
  splitPercent   Decimal           @db.Decimal(5, 2) // 100.00 solo, 50.00 if co-listed
  commission     CommissionRecord?

  @@unique([transactionId, agentId])
  @@index([agentId])
}

// ───────────── 5. COMMISSION LEDGER ─────────────

// One payout row per agent per transaction. The composite relation guarantees
// the agent was actually on the deal.
model CommissionRecord {
  id                  String           @id @default(uuid())
  transactionId       String
  agentId             String
  transaction         Transaction      @relation(fields: [transactionId], references: [id])
  agent               Agent            @relation(fields: [agentId], references: [id])
  transactionAgent    TransactionAgent @relation(fields: [transactionId, agentId], references: [transactionId, agentId])
  grossCommission     Decimal          @db.Decimal(12, 2) // this agent's share of GCI, e.g. 115500.00
  agentSplitPercent   Decimal          @db.Decimal(5, 2) // tier at time of deal, e.g. 90.00
  brokerageCompanyCut Decimal          @db.Decimal(12, 2) // e.g. 11550.00
  agentNetPayout      Decimal          @db.Decimal(12, 2) // e.g. 103950.00
  approvedAt          DateTime?
  approvedById        String?
  approvedBy          User?            @relation("CommissionApprover", fields: [approvedById], references: [id])
  paidAt              DateTime?
  createdAt           DateTime         @default(now())

  @@unique([transactionId, agentId])
  @@index([agentId, paidAt])
}

// ───────────── 6. EXECUTIVE TARGETS ─────────────

model BrokerageAnnualGoal {
  id         String  @id @default(uuid())
  year       Int     @unique // 2024
  volumeGoal Decimal @db.Decimal(14, 2) // 60000000.00
}

model BrokerageMonthlyTarget {
  id              String  @id @default(uuid())
  year            Int
  month           Int // 1–12
  targetVolume    Decimal @db.Decimal(14, 2) // 8500000.00
  mlsBenchmarkDom Int? // regional MLS average DOM for the month, e.g. 34

  @@unique([year, month])
}
```

### 3a. One extra database rule (add to the first migration)

Prisma can't express "only one **open** escrow per listing", so add this line to the generated migration SQL:

```sql
CREATE UNIQUE INDEX "Transaction_one_open_per_listing"
  ON "Transaction"("listingId") WHERE status = 'OPEN';
```

### 3b. Rules the application code must enforce

| Rule | Where |
| :--- | :--- |
| `TransactionAgent.splitPercent` values on a deal add up to 100 | When agents are added to a deal |
| `CommissionRecord`: `brokerageCompanyCut + agentNetPayout = grossCommission` | When a payout is created |
| When a deal closes: set `Transaction.status = CLOSED`, `actualClosingDate`, `Listing.status = CLOSED`, `Listing.offMarketAt` | "Close escrow" action |
| When a deal cancels: set `status = CANCELLED`, `cancelledAt`, and put the listing back to `ACTIVE` | "Cancel escrow" action |
| Only `MANAGING_BROKER` can set `approvedAt` / `approvedById` on payouts | Commission approval endpoint |

### 3c. Who can see what

| Data | `AGENT` | `ADMIN` | `MANAGING_BROKER` |
| :--- | :--- | :--- | :--- |
| Listings, roster names/contact info | All | All | All |
| Transactions | Own deals only | All | All |
| Commission payouts & split tiers | **Own only** | All | All |
| Approve payouts / audit HUD-1 | No | No | Yes |
| Onboarding records | Own only | All | All |

Enforce this in the API layer on every query, e.g. filter by the logged-in agent's ID when the role is `AGENT`. PostgreSQL Row-Level Security can be added as a second layer.

---

## 4. How the Code Connects to What You See on Screen

| Screen | UI Element You See | How it's calculated |
| :--- | :--- | :--- |
| **Dashboard** | **"$48.6M Closed Volume"** | Sum of `Transaction.finalAgreedPrice` where `status = CLOSED` and `actualClosingDate` falls in the year |
| **Dashboard** | **"24 Deals Under Contract"** | Count of `Transaction` rows where `status = OPEN` |
| **Dashboard** | **"$19.2M in escrow"** | Sum of `finalAgreedPrice` where `status = OPEN` |
| **Dashboard** | **"$1.46M YTD GCI"** | Sum of `CommissionRecord.grossCommission` on deals closed this year |
| **Dashboard** | **"Sept target $8.50M vs $6.90M pacing"** | Target: `BrokerageMonthlyTarget`. Pacing: closed volume so far this month. Projected = pacing ÷ days elapsed × days in month |
| **Dashboard** | **"21 vs 34 days DOM"** | Average Days on Market of our listings vs `BrokerageMonthlyTarget.mlsBenchmarkDom` |
| **Listings** | **"$3,850,000 — 742 Evergreen Terrace"** | One `Listing` row linked to Marcus Vance, cover photo = `ListingPhoto` with `sortOrder = 0` |
| **Listings** | **"21 Days on Market"** | Days between `listedAt` and `offMarketAt` (or today if still active) |
| **Listings** | **"Day 12 of Escrow"** | Days since `Transaction.escrowStartDate`, plus 1 |
| **Listings** | **"48h inspection contingency"** | Earliest `Contingency.deadline` not yet removed, minus now |
| **Roster** | **"#1 Marcus Vance (90/10 Split, $372K GCI)"** | `Agent.splitTier` + sum of his `CommissionRecord.grossCommission` on deals closed YTD* |
| **Onboarding** | **"Sarah Lin — 83% — Awaiting State DRE"** | Completed steps ÷ total steps (5 of 6), plus the step whose status is `AWAITING_EXTERNAL` and its blocker note** |

\* Decide whether the leaderboard shows **gross** commission (GCI, what the agent brought in) or **net** payout (what the agent took home). Both are stored.

\*\* With 6 equal steps, percentages come in steps of ~17% (5 of 6 = 83%, not 85%). If the design needs finer progress, give each step a weight.

---

## 5. What Changed from v1 (and Why)

| # | v1 issue | v2 fix |
| :--- | :--- | :--- |
| 1 | `CommissionRecord` allowed only **one agent per deal**, so co-listed deals couldn't be paid out to both agents | One payout per agent per deal, tied to `TransactionAgent` by a database constraint |
| 2 | Section 4 referenced `CommissionRecord.finalAgreedPrice` and a `CLOSED` status, and **neither existed** | `Transaction.status` (`OPEN`/`CLOSED`/`CANCELLED`) + `actualClosingDate`; queries rewritten |
| 3 | `daysOnMarket`, `currentDayOfEscrow`, `contingencyHoursLeft`, `daysRemaining`, `progressPercent`, `projectedVolume` were stored, so they would **go stale** | Replaced with dates (`listedAt`, `offMarketAt`, `escrowStartDate`, `Contingency.deadline`) and calculated live |
| 4 | Onboarding steps in the schema didn't match the doc (no W-9, Supra eKey, mentorship); several true/false flags repeated `currentStep` | Steps match the doc; one `OnboardingStepProgress` row per step with status and blocker note |
| 5 | `Transaction.listingId` was unique, so a home **couldn't re-enter escrow** after a fall-through | Many transactions per listing; at most one `OPEN` (partial unique index) |
| 6 | **No login or permissions**, even though the doc promises that splits stay private | `User` model with `MANAGING_BROKER` / `ADMIN` / `AGENT` roles + access table |
| 7 | Changing an agent's tier would make past splits ambiguous | `agentSplitPercent` saved on each payout |
| 8 | `isApprovedByBroker` / `isHud1Audited` were plain yes/no | Replaced with *who* and *when* (`approvedById`/`approvedAt`, `hud1AuditedById`/`hud1AuditedAt`) for an audit trail |
| 9 | Escrow company promised but missing; single `imageUrl`; `zipCode` defaulted to 90210; `representation` was free text; same agent could be added to a deal twice | Added `escrowCompany`; `ListingPhoto` table; no zip default; `Representation` enum; unique (deal, agent) |
| 10 | Monthly target row mixed in the annual goal and calculated fields | Split into `BrokerageAnnualGoal` and `BrokerageMonthlyTarget` (targets + MLS benchmark only) |
| 11 | No indexes for common dashboard queries | Indexes on statuses, closing dates, agent IDs |
