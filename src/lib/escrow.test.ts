import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { cancelEscrow, closeEscrow, EscrowError } from "./escrow";

const db = new PrismaClient();
const tag = `test-${randomUUID().slice(0, 8)}`;
const created = { agents: [] as string[], listings: [] as string[] };

async function makeAgent(splitTier: "TIER_PRESTIGE_90_10" | "TIER_ASSOCIATE_80_20") {
  const id = randomUUID();
  await db.agent.create({
    data: { id, firstName: "Test", lastName: id.slice(0, 6), email: `${id}@${tag}.test`, phone: "1", licenseNumber: `${tag}-${id}`, title: "Test", splitTier },
  });
  created.agents.push(id);
  return id;
}

async function makeDeal(sides: { agentId: string; share: number }[]) {
  const listing = await db.listing.create({
    data: {
      mlsNumber: `${tag}-${randomUUID()}`, address: "1 Test St", city: "LA", zipCode: "90001", price: 1_000_000,
      status: "PENDING_ESCROW", bedrooms: 3, bathrooms: 2, squareFeet: 2000, listedAt: new Date(), primaryAgentId: sides[0].agentId,
    },
  });
  created.listings.push(listing.id);
  return db.transaction.create({
    data: {
      listingId: listing.id, escrowNumber: `${tag}-${randomUUID()}`, escrowCompany: "Test Escrow",
      finalAgreedPrice: 1_000_000, grossCommissionPercent: 3, escrowStartDate: new Date(), targetClosingDate: new Date(),
      agents: { create: sides.map((s) => ({ agentId: s.agentId, representation: "SELLER" as const, splitPercent: s.share })) },
    },
  });
}

let prestige: string;
let associate: string;

beforeEach(async () => {
  prestige = await makeAgent("TIER_PRESTIGE_90_10");
  associate = await makeAgent("TIER_ASSOCIATE_80_20");
});

afterAll(async () => {
  const tx = { listingId: { in: created.listings } };
  await db.commissionRecord.deleteMany({ where: { transaction: tx } });
  await db.transactionAgent.deleteMany({ where: { transaction: tx } });
  await db.transaction.deleteMany({ where: tx });
  await db.listing.deleteMany({ where: { id: { in: created.listings } } });
  await db.agent.deleteMany({ where: { id: { in: created.agents } } });
  await db.$disconnect();
});

describe("closeEscrow", () => {
  it("closes the deal and listing and pays each co-listing agent at their own tier", async () => {
    const deal = await makeDeal([{ agentId: prestige, share: 50 }, { agentId: associate, share: 50 }]);
    await closeEscrow(db, deal.id);

    const closed = await db.transaction.findUniqueOrThrow({ where: { id: deal.id }, include: { listing: true, commissionRecords: true } });
    expect(closed.status).toBe("CLOSED");
    expect(closed.actualClosingDate).not.toBeNull();
    expect(closed.listing.status).toBe("CLOSED");
    expect(closed.commissionRecords).toHaveLength(2);

    const byAgent = Object.fromEntries(closed.commissionRecords.map((r) => [r.agentId, r]));
    expect(byAgent[prestige].grossCommission.toString()).toBe("15000");
    expect(byAgent[prestige].agentNetPayout.toString()).toBe("13500");
    expect(byAgent[associate].agentSplitPercent.toString()).toBe("80");
    expect(byAgent[associate].agentNetPayout.toString()).toBe("12000");
  });

  it("refuses to close when shares don't add up to 100%", async () => {
    const deal = await makeDeal([{ agentId: prestige, share: 60 }, { agentId: associate, share: 50 }]);
    await expect(closeEscrow(db, deal.id)).rejects.toBeInstanceOf(EscrowError);
    const after = await db.transaction.findUniqueOrThrow({ where: { id: deal.id } });
    expect(after.status).toBe("OPEN");
  });

  it("refuses to close a deal twice", async () => {
    const deal = await makeDeal([{ agentId: prestige, share: 100 }]);
    await closeEscrow(db, deal.id);
    await expect(closeEscrow(db, deal.id)).rejects.toThrow("Only open escrows");
  });
});

describe("cancelEscrow", () => {
  it("keeps the record, relists the home, and allows a new escrow on it", async () => {
    const deal = await makeDeal([{ agentId: prestige, share: 100 }]);
    await cancelEscrow(db, deal.id);
    const after = await db.transaction.findUniqueOrThrow({ where: { id: deal.id }, include: { listing: true } });
    expect(after.status).toBe("CANCELLED");
    expect(after.listing.status).toBe("ACTIVE");

    await expect(
      db.transaction.create({
        data: { listingId: deal.listingId, escrowNumber: `${tag}-${randomUUID()}`, escrowCompany: "X", finalAgreedPrice: 1, grossCommissionPercent: 3, escrowStartDate: new Date(), targetClosingDate: new Date() },
      }),
    ).resolves.toBeTruthy();
  });

  it("the database blocks a second open escrow on the same home", async () => {
    const deal = await makeDeal([{ agentId: prestige, share: 100 }]);
    await expect(
      db.transaction.create({
        data: { listingId: deal.listingId, escrowNumber: `${tag}-${randomUUID()}`, escrowCompany: "X", finalAgreedPrice: 1, grossCommissionPercent: 3, escrowStartDate: new Date(), targetClosingDate: new Date() },
      }),
    ).rejects.toThrow();
  });
});
