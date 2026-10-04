import bcrypt from "bcryptjs";
import {
  PrismaClient,
  type OnboardingStep,
  type Representation,
  type SplitTier,
  type StepStatus,
} from "@prisma/client";
import { SPLIT_TIER_AGENT_PERCENT, computeCommission, ONBOARDING_STEPS } from "../src/lib/calc";

const prisma = new PrismaClient();
const DEMO_PASSWORD = "Password123!";

const now = new Date();
const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(now.getTime() - n * DAY);
const daysFromNow = (n: number) => new Date(now.getTime() + n * DAY);
const hoursFromNow = (n: number) => new Date(now.getTime() + n * 3_600_000);
const yearStart = new Date(now.getFullYear(), 0, 1);
/** A date at `fraction` of the way from Jan 1 to now, so closed deals always fall in the current year. */
const yearFraction = (fraction: number) =>
  new Date(yearStart.getTime() + fraction * (now.getTime() - yearStart.getTime()));

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "1") {
    throw new Error("Refusing to load demo data in production. Set ALLOW_DEMO_SEED=1 to override.");
  }

  await prisma.$transaction([
    prisma.commissionRecord.deleteMany(),
    prisma.contingency.deleteMany(),
    prisma.transactionAgent.deleteMany(),
    prisma.transaction.deleteMany(),
    prisma.listingPhoto.deleteMany(),
    prisma.listing.deleteMany(),
    prisma.onboardingStepProgress.deleteMany(),
    prisma.onboardingRecord.deleteMany(),
    prisma.agent.updateMany({ data: { mentorId: null } }),
    prisma.agent.deleteMany(),
    prisma.user.deleteMany(),
    prisma.brokerageMonthlyTarget.deleteMany(),
    prisma.brokerageAnnualGoal.deleteMany(),
  ]);

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const broker = await prisma.user.create({
    data: { email: "broker@aprealty.test", name: "Andrea Price", role: "MANAGING_BROKER", passwordHash },
  });
  await prisma.user.create({
    data: { email: "admin@aprealty.test", name: "Jordan Lee", role: "ADMIN", passwordHash },
  });

  type AgentSeed = {
    key: string;
    firstName: string;
    lastName: string;
    title: string;
    tier: SplitTier;
    license: string;
    status?: "ACTIVE" | "ONBOARDING";
    login?: boolean;
    userId?: string;
    mentor?: string;
  };
  const agentSeeds: AgentSeed[] = [
    { key: "andrea", firstName: "Andrea", lastName: "Price", title: "Managing Broker", tier: "TIER_PRESTIGE_90_10", license: "01844210", userId: broker.id },
    { key: "marcus", firstName: "Marcus", lastName: "Vance", title: "Senior Managing Associate", tier: "TIER_PRESTIGE_90_10", license: "02194880", login: true },
    { key: "elena", firstName: "Elena", lastName: "Rostova", title: "Luxury Estates Associate", tier: "TIER_STANDARD_85_15", license: "02077315", login: true },
    { key: "david", firstName: "David", lastName: "Okafor", title: "Associate", tier: "TIER_ASSOCIATE_80_20", license: "02233019" },
    { key: "priya", firstName: "Priya", lastName: "Shah", title: "Associate", tier: "TIER_STANDARD_85_15", license: "02150472" },
    { key: "tom", firstName: "Tom", lastName: "Reilly", title: "Associate", tier: "TIER_ASSOCIATE_80_20", license: "02261145" },
    { key: "sarah", firstName: "Sarah", lastName: "Lin", title: "Associate (Onboarding)", tier: "TIER_INCUBATOR_70_30", license: "02310887", status: "ONBOARDING", login: true, mentor: "marcus" },
    { key: "kevin", firstName: "Kevin", lastName: "Moreno", title: "Associate (Onboarding)", tier: "TIER_INCUBATOR_70_30", license: "02315520", status: "ONBOARDING", mentor: "elena" },
    { key: "nina", firstName: "Nina", lastName: "Alvarez", title: "Associate (Onboarding)", tier: "TIER_INCUBATOR_70_30", license: "02318064", status: "ONBOARDING", mentor: "marcus" },
  ];

  const agents: Record<string, { id: string }> = {};
  for (const [i, a] of agentSeeds.entries()) {
    const email = `${a.firstName.toLowerCase()}@aprealty.test`;
    let userId = a.userId;
    if (a.login) {
      const user = await prisma.user.create({
        data: { email, name: `${a.firstName} ${a.lastName}`, role: "AGENT", passwordHash },
      });
      userId = user.id;
    }
    agents[a.key] = await prisma.agent.create({
      data: {
        userId,
        firstName: a.firstName,
        lastName: a.lastName,
        email,
        phone: `(310) 555-01${String(i + 10).padStart(2, "0")}`,
        licenseNumber: a.license,
        title: a.title,
        status: a.status ?? "ACTIVE",
        splitTier: a.tier,
      },
    });
  }
  for (const a of agentSeeds.filter((s) => s.mentor)) {
    await prisma.agent.update({ where: { id: agents[a.key].id }, data: { mentorId: agents[a.mentor!].id } });
  }

  // Onboarding
  const onboarding: Record<string, { status: Partial<Record<OnboardingStep, StepStatus>>; notes: Partial<Record<OnboardingStep, string>>; weeks: number }> = {
    sarah: {
      status: {
        W9_AND_BROKER_AGREEMENT: "COMPLETE",
        STATE_DRE_LICENSE_TRANSFER: "AWAITING_EXTERNAL",
        MLS_BOARD_ACCESS: "COMPLETE",
        SUPRA_EKEY: "COMPLETE",
        CRM_PROVISIONING: "COMPLETE",
        MENTOR_ASSIGNMENT: "COMPLETE",
      },
      notes: { STATE_DRE_LICENSE_TRANSFER: "Awaiting State DRE approval" },
      weeks: 1,
    },
    kevin: {
      status: { W9_AND_BROKER_AGREEMENT: "COMPLETE", STATE_DRE_LICENSE_TRANSFER: "COMPLETE", MLS_BOARD_ACCESS: "IN_PROGRESS" },
      notes: { MLS_BOARD_ACCESS: "Orientation booked for next Tuesday" },
      weeks: 4,
    },
    nina: {
      status: {
        W9_AND_BROKER_AGREEMENT: "COMPLETE",
        STATE_DRE_LICENSE_TRANSFER: "COMPLETE",
        MLS_BOARD_ACCESS: "COMPLETE",
        SUPRA_EKEY: "BLOCKED",
        CRM_PROVISIONING: "COMPLETE",
      },
      notes: { SUPRA_EKEY: "Waiting on MLS board dues payment" },
      weeks: 2,
    },
  };
  for (const [key, o] of Object.entries(onboarding)) {
    await prisma.onboardingRecord.create({
      data: {
        agentId: agents[key].id,
        backgroundCheckClearedAt: daysAgo(20),
        targetGraduationDate: daysFromNow(o.weeks * 7),
        steps: {
          create: ONBOARDING_STEPS.map((step) => {
            const status = o.status[step] ?? "NOT_STARTED";
            return { step, status, blockerNote: o.notes[step] ?? null, completedAt: status === "COMPLETE" ? daysAgo(5) : null };
          }),
        },
      },
    });
  }

  // Listings and deals
  let mls = 9100;
  let escrow = 5000;
  let photo = 0;
  async function listing(input: {
    address: string; city: string; zipCode: string; price: number; agent: string;
    status: "COMING_SOON" | "ACTIVE" | "PENDING_ESCROW" | "CLOSED" | "WITHDRAWN";
    beds: number; baths: number; sqft: number; listedAt: Date | null; offMarketAt?: Date | null;
    showings?: number; offers?: number;
  }) {
    photo = (photo % 4) + 1;
    return prisma.listing.create({
      data: {
        mlsNumber: `24-${mls++}`,
        address: input.address, city: input.city, zipCode: input.zipCode, price: input.price,
        status: input.status, bedrooms: input.beds, bathrooms: input.baths, squareFeet: input.sqft,
        listedAt: input.listedAt, offMarketAt: input.offMarketAt ?? null,
        showingCount: input.showings ?? 0, offerCount: input.offers ?? 0,
        primaryAgentId: agents[input.agent].id,
        photos: { create: [{ url: `/listings-img/house-${photo}.svg`, sortOrder: 0 }] },
      },
    });
  }

  type Side = { agent: string; rep: Representation; share: number };
  async function deal(listingId: string, input: {
    status: "OPEN" | "CLOSED" | "CANCELLED"; price: number; sides: Side[]; start: Date; targetClose: Date;
    closedAt?: Date; approved?: boolean; paid?: boolean; contingencies?: { type: "INSPECTION" | "APPRAISAL" | "LOAN"; deadline: Date; removed?: boolean }[];
  }) {
    const t = await prisma.transaction.create({
      data: {
        listingId, status: input.status, escrowNumber: `ESC-${escrow++}`, escrowCompany: "Westside Escrow Co.",
        finalAgreedPrice: input.price, grossCommissionPercent: 3, escrowStartDate: input.start,
        targetClosingDate: input.targetClose, actualClosingDate: input.closedAt ?? null,
        cancelledAt: input.status === "CANCELLED" ? input.targetClose : null,
        hud1AuditedAt: input.status === "CLOSED" ? input.closedAt : null,
        hud1AuditedById: input.status === "CLOSED" ? broker.id : null,
        agents: { create: input.sides.map((s) => ({ agentId: agents[s.agent].id, representation: s.rep, splitPercent: s.share })) },
        contingencies: { create: (input.contingencies ?? []).map((c) => ({ type: c.type, deadline: c.deadline, removedAt: c.removed ? c.deadline : null })) },
      },
    });
    if (input.status === "CLOSED") {
      for (const s of input.sides) {
        const tier = agentSeeds.find((a) => a.key === s.agent)!.tier;
        const agentSplitPercent = SPLIT_TIER_AGENT_PERCENT[tier];
        await prisma.commissionRecord.create({
          data: {
            transactionId: t.id, agentId: agents[s.agent].id, agentSplitPercent,
            ...computeCommission({ finalAgreedPrice: input.price, grossCommissionPercent: 3, agentSharePercent: s.share, agentSplitPercent }),
            approvedAt: input.approved === false ? null : input.closedAt,
            approvedById: input.approved === false ? null : broker.id,
            paidAt: input.paid === false || input.approved === false ? null : input.closedAt,
          },
        });
      }
    }
    return t;
  }

  // Closed this year: $48.6M volume → $1.458M GCI at 3%; Marcus = $12.4M → $372K GCI
  const closed: { address: string; city: string; zip: string; price: number; sides: Side[]; at: number; approved?: boolean; paid?: boolean }[] = [
    { address: "12 Bel Air Crest", city: "Los Angeles", zip: "90077", price: 4_200_000, sides: [{ agent: "marcus", rep: "SELLER", share: 100 }], at: 0.08 },
    { address: "901 N Roxbury Dr", city: "Beverly Hills", zip: "90210", price: 6_500_000, sides: [{ agent: "andrea", rep: "SELLER", share: 100 }], at: 0.15 },
    { address: "2200 Pacific Coast Hwy", city: "Malibu", zip: "90265", price: 5_350_000, sides: [{ agent: "elena", rep: "DUAL", share: 100 }], at: 0.22 },
    { address: "48 Carbon Mesa Rd", city: "Malibu", zip: "90265", price: 3_600_000, sides: [{ agent: "marcus", rep: "BUYER", share: 100 }], at: 0.3 },
    { address: "615 Alta Ave", city: "Santa Monica", zip: "90402", price: 3_950_000, sides: [{ agent: "elena", rep: "SELLER", share: 100 }], at: 0.36 },
    { address: "1420 Blue Jay Way", city: "Los Angeles", zip: "90069", price: 4_000_000, sides: [{ agent: "david", rep: "SELLER", share: 50 }, { agent: "priya", rep: "SELLER", share: 50 }], at: 0.44 },
    { address: "77 Stone Canyon Rd", city: "Los Angeles", zip: "90077", price: 2_750_000, sides: [{ agent: "marcus", rep: "SELLER", share: 100 }], at: 0.5 },
    { address: "305 S Camden Dr", city: "Beverly Hills", zip: "90212", price: 2_900_000, sides: [{ agent: "elena", rep: "BUYER", share: 100 }], at: 0.56 },
    { address: "8840 Hollywood Blvd", city: "Los Angeles", zip: "90069", price: 2_800_000, sides: [{ agent: "priya", rep: "SELLER", share: 100 }], at: 0.62 },
    { address: "1129 Ocean Park Blvd", city: "Santa Monica", zip: "90405", price: 2_100_000, sides: [{ agent: "david", rep: "BUYER", share: 100 }], at: 0.68 },
    { address: "16 Rustic Canyon Ln", city: "Los Angeles", zip: "90049", price: 2_350_000, sides: [{ agent: "elena", rep: "SELLER", share: 100 }], at: 0.74 },
    { address: "4410 Ventura Canyon Ave", city: "Sherman Oaks", zip: "91423", price: 1_450_000, sides: [{ agent: "tom", rep: "SELLER", share: 100 }], at: 0.8 },
    { address: "622 Sycamore Rd", city: "Santa Monica", zip: "90402", price: 1_950_000, sides: [{ agent: "priya", rep: "BUYER", share: 100 }], at: 0.85 },
    { address: "3301 Coldwater Canyon", city: "Studio City", zip: "91604", price: 1_650_000, sides: [{ agent: "david", rep: "SELLER", share: 100 }], at: 0.9 },
    { address: "210 Amalfi Dr", city: "Los Angeles", zip: "90402", price: 1_850_000, sides: [{ agent: "marcus", rep: "SELLER", share: 100 }], at: 0.96, paid: false },
    { address: "5521 Woodman Ave", city: "Sherman Oaks", zip: "91401", price: 1_200_000, sides: [{ agent: "tom", rep: "BUYER", share: 100 }], at: 0.99, approved: false },
  ];
  for (const [i, c] of closed.entries()) {
    const closedAt = yearFraction(c.at);
    const listedAt = new Date(closedAt.getTime() - (55 + i * 3) * DAY);
    const start = new Date(closedAt.getTime() - 30 * DAY);
    const l = await listing({
      address: c.address, city: c.city, zipCode: c.zip, price: c.price, agent: c.sides[0].agent, status: "CLOSED",
      beds: 3 + (i % 4), baths: 2.5 + (i % 3), sqft: 2400 + i * 310, listedAt, offMarketAt: start,
      showings: 20 + i, offers: 1 + (i % 4),
    });
    await deal(l.id, { status: "CLOSED", price: c.price, sides: c.sides, start, targetClose: closedAt, closedAt, approved: c.approved, paid: c.paid });
  }

  // Active inventory and open escrows
  const evergreen = await listing({
    address: "742 Evergreen Terrace", city: "Beverly Hills", zipCode: "90210", price: 3_850_000, agent: "marcus",
    status: "PENDING_ESCROW", beds: 6, baths: 6.5, sqft: 8200, listedAt: daysAgo(32), offMarketAt: daysAgo(11), showings: 41, offers: 4,
  });
  await deal(evergreen.id, {
    status: "OPEN", price: 3_850_000, sides: [{ agent: "marcus", rep: "SELLER", share: 100 }], start: daysAgo(11), targetClose: daysFromNow(19),
    contingencies: [{ type: "INSPECTION", deadline: hoursFromNow(48) }, { type: "LOAN", deadline: daysFromNow(10) }],
  });

  const palisades = await listing({
    address: "310 Palisades Ave", city: "Santa Monica", zipCode: "90402", price: 4_100_000, agent: "elena",
    status: "PENDING_ESCROW", beds: 5, baths: 5, sqft: 5600, listedAt: daysAgo(40), offMarketAt: daysAgo(18), showings: 33, offers: 3,
  });
  await deal(palisades.id, {
    status: "OPEN", price: 4_025_000, sides: [{ agent: "elena", rep: "SELLER", share: 100 }], start: daysAgo(18), targetClose: daysFromNow(12),
    contingencies: [{ type: "INSPECTION", deadline: daysAgo(8), removed: true }, { type: "APPRAISAL", deadline: daysFromNow(5) }],
  });

  const laurel = await listing({
    address: "28 Laurel Canyon Ct", city: "Los Angeles", zipCode: "90046", price: 1_895_000, agent: "david",
    status: "PENDING_ESCROW", beds: 4, baths: 3, sqft: 3100, listedAt: daysAgo(26), offMarketAt: daysAgo(6), showings: 22, offers: 2,
  });
  await deal(laurel.id, {
    status: "OPEN", price: 1_910_000, sides: [{ agent: "david", rep: "SELLER", share: 50 }, { agent: "priya", rep: "SELLER", share: 50 }],
    start: daysAgo(6), targetClose: daysFromNow(24), contingencies: [{ type: "INSPECTION", deadline: daysFromNow(4) }],
  });

  const mulholland = await listing({
    address: "77 Mulholland Estates", city: "Sherman Oaks", zipCode: "91403", price: 3_275_000, agent: "tom",
    status: "ACTIVE", beds: 5, baths: 4.5, sqft: 4900, listedAt: daysAgo(52), showings: 37, offers: 1,
  });
  await deal(mulholland.id, {
    status: "CANCELLED", price: 3_200_000, sides: [{ agent: "tom", rep: "SELLER", share: 100 }], start: daysAgo(30), targetClose: daysAgo(9),
  });

  await listing({ address: "1180 Summit Ridge Dr", city: "Beverly Hills", zipCode: "90210", price: 5_200_000, agent: "elena", status: "ACTIVE", beds: 6, baths: 7, sqft: 7400, listedAt: daysAgo(14), showings: 12, offers: 0 });
  await listing({ address: "455 Ocean Vista Ln", city: "Malibu", zipCode: "90265", price: 7_450_000, agent: "marcus", status: "ACTIVE", beds: 5, baths: 6, sqft: 6800, listedAt: daysAgo(19), showings: 9, offers: 1 });
  await listing({ address: "1650 Linda Flora Dr", city: "Los Angeles", zipCode: "90077", price: 2_495_000, agent: "priya", status: "ACTIVE", beds: 4, baths: 3.5, sqft: 3600, listedAt: daysAgo(8), showings: 6, offers: 0 });
  await listing({ address: "9021 Sunset Plaza Dr", city: "West Hollywood", zipCode: "90069", price: 2_640_000, agent: "priya", status: "COMING_SOON", beds: 3, baths: 3.5, sqft: 2900, listedAt: null });

  // Targets
  const year = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  await prisma.brokerageAnnualGoal.create({ data: { year, volumeGoal: 60_000_000 } });
  const otherMonths = (60_000_000 - 8_500_000) / 11;
  for (let month = 1; month <= 12; month++) {
    await prisma.brokerageMonthlyTarget.create({
      data: { year, month, targetVolume: month === currentMonth ? 8_500_000 : Math.round(otherMonths), mlsBenchmarkDom: 34 },
    });
  }

  console.log(`Seeded demo data. Demo logins (password "${DEMO_PASSWORD}"):`);
  console.log("  broker@aprealty.test (Managing Broker), admin@aprealty.test (Admin), marcus@aprealty.test (Agent), sarah@aprealty.test (Onboarding agent)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
