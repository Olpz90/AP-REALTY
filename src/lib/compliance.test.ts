import { describe, expect, it, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  complianceItemsForYear,
  complianceSummary,
  ensureComplianceYear,
  isIllinoisRenewalYear,
  ILLINOIS_REQUIREMENTS,
} from "./compliance";

const reqs = ILLINOIS_REQUIREMENTS.map((r) => ({ ...r, id: r.code, licenseTypes: r.licenseTypes ?? [] }));
const licensees = [
  { id: "omar", licenseType: "MANAGING_BROKER" as const },
  { id: "adam", licenseType: "BROKER" as const },
];

describe("Illinois compliance checklist", () => {
  it("treats even years as renewal years", () => {
    expect(isIllinoisRenewalYear(2026)).toBe(true);
    expect(isIllinoisRenewalYear(2027)).toBe(false);
  });

  it("adds renewal and CE items only in renewal years", () => {
    const odd = complianceItemsForYear(reqs, licensees, 2027);
    const even = complianceItemsForYear(reqs, licensees, 2026);
    const codes = (items: typeof odd) => new Set(items.map((i) => i.requirementId));
    expect(codes(odd).has("LICENSE_RENEWAL")).toBe(false);
    expect(codes(odd).has("CE_BROKER")).toBe(false);
    expect(codes(even).has("LICENSE_RENEWAL")).toBe(true);
    expect(even.length).toBeGreaterThan(odd.length);
  });

  it("gives each license type its own CE requirement", () => {
    const even = complianceItemsForYear(reqs, licensees, 2026);
    const ce = even.filter((i) => i.requirementId.startsWith("CE_"));
    expect(ce).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ agentId: "omar", requirementId: "CE_MANAGING_BROKER" }),
        expect.objectContaining({ agentId: "adam", requirementId: "CE_BROKER" }),
      ]),
    );
    expect(ce).toHaveLength(2);
  });

  it("creates brokerage-level items once with no agent", () => {
    const items = complianceItemsForYear(reqs, licensees, 2027).filter((i) => i.requirementId === "SOS_ANNUAL_REPORT");
    expect(items).toEqual([expect.objectContaining({ agentId: null })]);
    expect(items[0].dueDate.toISOString()).toBe("2027-12-31T12:00:00.000Z");
  });

  it("summarises progress, excluding N/A items and counting overdue ones", () => {
    const now = new Date("2026-07-01T00:00:00Z");
    const past = new Date("2026-01-31T12:00:00Z");
    const future = new Date("2026-12-31T12:00:00Z");
    const s = complianceSummary(
      [
        { status: "COMPLETE", dueDate: past },
        { status: "IN_PROGRESS", dueDate: past },
        { status: "NOT_STARTED", dueDate: future },
        { status: "NOT_APPLICABLE", dueDate: past },
      ],
      now,
    );
    expect(s).toEqual({ total: 3, complete: 1, overdue: 1, percent: 33 });
  });
});

describe("ensureComplianceYear (database)", () => {
  const db = new PrismaClient();
  const YEAR = 2098;
  afterAll(async () => {
    await db.complianceItem.deleteMany({ where: { year: YEAR } });
    await db.$disconnect();
  });

  it("creates the year's checklist once and is safe to re-run", async () => {
    await db.complianceItem.deleteMany({ where: { year: YEAR } });
    const created = await ensureComplianceYear(db, YEAR);
    expect(created).toBeGreaterThan(0);
    expect(await ensureComplianceYear(db, YEAR)).toBe(0);
    const brokerageRows = await db.complianceItem.count({ where: { year: YEAR, agentId: null } });
    expect(brokerageRows).toBe(ILLINOIS_REQUIREMENTS.filter((r) => r.scope === "BROKERAGE").length);
  });

  it("rejects a duplicate brokerage-level row", async () => {
    const req = await db.complianceRequirement.findUniqueOrThrow({ where: { code: "SOS_ANNUAL_REPORT" } });
    await expect(
      db.complianceItem.create({ data: { year: YEAR, requirementId: req.id, dueDate: new Date() } }),
    ).rejects.toThrow();
  });
});
