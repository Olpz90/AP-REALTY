import bcrypt from "bcryptjs";
import { PrismaClient, type LicenseType, type Representation, type SplitTier } from "@prisma/client";
import { SPLIT_TIER_AGENT_PERCENT, computeCommission } from "../src/lib/calc";
import { complianceDueDate, ensureComplianceYear, isIllinoisRenewalYear } from "../src/lib/compliance";

const prisma = new PrismaClient();
const DEMO_PASSWORD = "Password123!";

const now = new Date();
const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(now.getTime() - n * DAY);
const daysFromNow = (n: number) => new Date(now.getTime() + n * DAY);
const hoursFromNow = (n: number) => new Date(now.getTime() + n * 3_600_000);
const yearStart = new Date(now.getFullYear(), 0, 1);
const nextRenewalYear = [0, 1, 2].map((n) => now.getFullYear() + n).find((y) => isIllinoisRenewalYear(y) && complianceDueDate(y, 4, 30) > now)!;
/** A date at `fraction` of the way from Jan 1 to now, so closed deals always fall in the current year. */
const yearFraction = (fraction: number) =>
  new Date(yearStart.getTime() + fraction * (now.getTime() - yearStart.getTime()));

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "1") {
    throw new Error("Refusing to load demo data in production. Set ALLOW_DEMO_SEED=1 to override.");
  }

  await prisma.$transaction([
    prisma.complianceItem.deleteMany(),
    prisma.complianceRequirement.deleteMany(),
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
    data: { email: "omar@aprealty.test", name: "Omar Lopez", role: "MANAGING_BROKER", passwordHash },
  });
  await prisma.user.create({
    data: { email: "admin@aprealty.test", name: "Office Admin", role: "ADMIN", passwordHash },
  });

  // License numbers, phone numbers and splits are placeholders until real roster data is loaded.
  type AgentSeed = {
    key: string;
    firstName: string;
    lastName: string;
    title: string;
    licenseType: LicenseType;
    tier: SplitTier;
    license: string;
    userId?: string;
  };
  const agentSeeds: AgentSeed[] = [
    { key: "omar", firstName: "Omar", lastName: "Lopez", title: "Managing Broker", licenseType: "MANAGING_BROKER", tier: "TIER_PRESTIGE_90_10", license: "471.000101", userId: broker.id },
    { key: "adam", firstName: "Adam", lastName: "Delort", title: "Broker", licenseType: "BROKER", tier: "TIER_STANDARD_85_15", license: "475.000102" },
    { key: "lucy", firstName: "Lucy", lastName: "Castillo", title: "Broker", licenseType: "BROKER", tier: "TIER_ASSOCIATE_80_20", license: "475.000103" },
  ];

  const agents: Record<string, { id: string }> = {};
  for (const [i, a] of agentSeeds.entries()) {
    const email = `${a.firstName.toLowerCase()}@aprealty.test`;
    const userId =
      a.userId ??
      (await prisma.user.create({ data: { email, name: `${a.firstName} ${a.lastName}`, role: "AGENT", passwordHash } })).id;
    agents[a.key] = await prisma.agent.create({
      data: {
        userId,
        firstName: a.firstName,
        lastName: a.lastName,
        email,
        phone: `(312) 555-01${String(i + 10).padStart(2, "0")}`,
        licenseNumber: a.license,
        licenseType: a.licenseType,
        licenseExpiresAt: complianceDueDate(nextRenewalYear, 4, 30),
        title: a.title,
        status: "ACTIVE",
        splitTier: a.tier,
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
        listingId, status: input.status, escrowNumber: `ESC-${escrow++}`, escrowCompany: "Lakeshore Title Co.",
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

  // Closed this year: $48.6M volume → $1.458M GCI at 3%
  const closed: { address: string; city: string; zip: string; price: number; sides: Side[]; at: number; approved?: boolean; paid?: boolean }[] = [
    { address: "1840 N Lincoln Park West", city: "Chicago", zip: "60614", price: 4_200_000, sides: [{ agent: "adam", rep: "SELLER", share: 100 }], at: 0.08 },
    { address: "1430 N Astor St", city: "Chicago", zip: "60610", price: 6_500_000, sides: [{ agent: "omar", rep: "SELLER", share: 100 }], at: 0.15 },
    { address: "455 Sheridan Rd", city: "Winnetka", zip: "60093", price: 5_350_000, sides: [{ agent: "lucy", rep: "DUAL", share: 100 }], at: 0.22 },
    { address: "720 Greenwood Ave", city: "Glencoe", zip: "60022", price: 3_600_000, sides: [{ agent: "adam", rep: "BUYER", share: 100 }], at: 0.3 },
    { address: "1225 N Lake Shore Dr", city: "Chicago", zip: "60610", price: 3_950_000, sides: [{ agent: "lucy", rep: "SELLER", share: 100 }], at: 0.36 },
    { address: "530 W Belden Ave", city: "Chicago", zip: "60614", price: 4_000_000, sides: [{ agent: "adam", rep: "SELLER", share: 50 }, { agent: "lucy", rep: "SELLER", share: 50 }], at: 0.44 },
    { address: "245 E Westminster", city: "Lake Forest", zip: "60045", price: 2_750_000, sides: [{ agent: "adam", rep: "SELLER", share: 100 }], at: 0.5 },
    { address: "618 S Garfield St", city: "Hinsdale", zip: "60521", price: 2_900_000, sides: [{ agent: "lucy", rep: "BUYER", share: 100 }], at: 0.56 },
    { address: "2154 N Hudson Ave", city: "Chicago", zip: "60614", price: 2_800_000, sides: [{ agent: "lucy", rep: "SELLER", share: 100 }], at: 0.62 },
    { address: "915 Forest Ave", city: "Evanston", zip: "60202", price: 2_100_000, sides: [{ agent: "adam", rep: "BUYER", share: 100 }], at: 0.68 },
    { address: "1104 Ashland Ave", city: "River Forest", zip: "60305", price: 2_350_000, sides: [{ agent: "lucy", rep: "SELLER", share: 100 }], at: 0.74 },
    { address: "38 Natoma Dr", city: "Oak Brook", zip: "60523", price: 1_450_000, sides: [{ agent: "omar", rep: "SELLER", share: 100 }], at: 0.8 },
    { address: "1600 Elmwood Ave", city: "Wilmette", zip: "60091", price: 1_950_000, sides: [{ agent: "lucy", rep: "BUYER", share: 100 }], at: 0.85 },
    { address: "1015 N Wolcott Ave", city: "Chicago", zip: "60622", price: 1_650_000, sides: [{ agent: "adam", rep: "SELLER", share: 100 }], at: 0.9 },
    { address: "420 Kenilworth Ave", city: "Kenilworth", zip: "60043", price: 1_850_000, sides: [{ agent: "adam", rep: "SELLER", share: 100 }], at: 0.96, paid: false },
    { address: "1212 W Webster Ave", city: "Chicago", zip: "60614", price: 1_200_000, sides: [{ agent: "lucy", rep: "BUYER", share: 100 }], at: 0.99, approved: false },
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
    address: "742 Evergreen Terrace", city: "Winnetka", zipCode: "60093", price: 3_850_000, agent: "adam",
    status: "PENDING_ESCROW", beds: 6, baths: 6.5, sqft: 8200, listedAt: daysAgo(32), offMarketAt: daysAgo(11), showings: 41, offers: 4,
  });
  await deal(evergreen.id, {
    status: "OPEN", price: 3_850_000, sides: [{ agent: "adam", rep: "SELLER", share: 100 }], start: daysAgo(11), targetClose: daysFromNow(19),
    contingencies: [{ type: "INSPECTION", deadline: hoursFromNow(48) }, { type: "LOAN", deadline: daysFromNow(10) }],
  });

  const palisades = await listing({
    address: "310 Sheridan Rd", city: "Highland Park", zipCode: "60035", price: 4_100_000, agent: "lucy",
    status: "PENDING_ESCROW", beds: 5, baths: 5, sqft: 5600, listedAt: daysAgo(40), offMarketAt: daysAgo(18), showings: 33, offers: 3,
  });
  await deal(palisades.id, {
    status: "OPEN", price: 4_025_000, sides: [{ agent: "lucy", rep: "SELLER", share: 100 }], start: daysAgo(18), targetClose: daysFromNow(12),
    contingencies: [{ type: "INSPECTION", deadline: daysAgo(8), removed: true }, { type: "APPRAISAL", deadline: daysFromNow(5) }],
  });

  const laurel = await listing({
    address: "28 Laurel Ave", city: "Wilmette", zipCode: "60091", price: 1_895_000, agent: "adam",
    status: "PENDING_ESCROW", beds: 4, baths: 3, sqft: 3100, listedAt: daysAgo(26), offMarketAt: daysAgo(6), showings: 22, offers: 2,
  });
  await deal(laurel.id, {
    status: "OPEN", price: 1_910_000, sides: [{ agent: "adam", rep: "SELLER", share: 50 }, { agent: "lucy", rep: "SELLER", share: 50 }],
    start: daysAgo(6), targetClose: daysFromNow(24), contingencies: [{ type: "INSPECTION", deadline: daysFromNow(4) }],
  });

  const mulholland = await listing({
    address: "77 Lakewood Dr", city: "Barrington", zipCode: "60010", price: 3_275_000, agent: "omar",
    status: "ACTIVE", beds: 5, baths: 4.5, sqft: 4900, listedAt: daysAgo(52), showings: 37, offers: 1,
  });
  await deal(mulholland.id, {
    status: "CANCELLED", price: 3_200_000, sides: [{ agent: "omar", rep: "SELLER", share: 100 }], start: daysAgo(30), targetClose: daysAgo(9),
  });

  await listing({ address: "1180 Green Bay Rd", city: "Glencoe", zipCode: "60022", price: 5_200_000, agent: "lucy", status: "ACTIVE", beds: 6, baths: 7, sqft: 7400, listedAt: daysAgo(14), showings: 12, offers: 0 });
  await listing({ address: "455 E Deerpath Rd", city: "Lake Forest", zipCode: "60045", price: 7_450_000, agent: "adam", status: "ACTIVE", beds: 5, baths: 6, sqft: 6800, listedAt: daysAgo(19), showings: 9, offers: 1 });
  await listing({ address: "1650 N Wells St", city: "Chicago", zipCode: "60614", price: 2_495_000, agent: "lucy", status: "ACTIVE", beds: 4, baths: 3.5, sqft: 3600, listedAt: daysAgo(8), showings: 6, offers: 0 });
  await listing({ address: "921 W Armitage Ave", city: "Chicago", zipCode: "60614", price: 2_640_000, agent: "lucy", status: "COMING_SOON", beds: 3, baths: 3.5, sqft: 2900, listedAt: null });

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

  // Illinois compliance: last year fully done, this year partly done
  for (const y of [year - 1, year]) await ensureComplianceYear(prisma, y);
  const items = await prisma.complianceItem.findMany({ include: { requirement: true } });
  const inProgress: Record<string, string> = {
    ADVERTISING_REVIEW: "Website reviewed; social media audit still open",
    ESCROW_RECONCILIATION: "January through last month reconciled",
  };
  for (const item of items) {
    const note = item.year === year ? inProgress[item.requirement.code] : undefined;
    const done = !note && item.dueDate < now;
    await prisma.complianceItem.update({
      where: { id: item.id },
      data: done
        ? { status: "COMPLETE", completedAt: new Date(item.dueDate.getTime() - 5 * DAY), completedById: broker.id }
        : { status: note ? "IN_PROGRESS" : "NOT_STARTED", note: note ?? null },
    });
  }

  console.log(`Seeded demo data. Demo logins (password "${DEMO_PASSWORD}"):`);
  console.log("  omar@aprealty.test (Managing Broker), admin@aprealty.test (Admin), adam@aprealty.test and lucy@aprealty.test (Brokers)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
