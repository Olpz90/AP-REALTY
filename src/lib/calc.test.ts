import { describe, expect, it } from "vitest";
import {
  computeCommission,
  daysOnMarket,
  escrowDay,
  monthPacing,
  nextContingency,
  onboardingProgress,
  sharesAddUpTo100,
  splitLabel,
} from "./calc";

describe("computeCommission", () => {
  it("matches the doc example: $3.85M at 3% on a 90/10 split", () => {
    const r = computeCommission({ finalAgreedPrice: 3_850_000, grossCommissionPercent: 3, agentSharePercent: 100, agentSplitPercent: 90 });
    expect(r.grossCommission.toString()).toBe("115500");
    expect(r.brokerageCompanyCut.toString()).toBe("11550");
    expect(r.agentNetPayout.toString()).toBe("103950");
  });

  it("splits a co-listed deal by each agent's share", () => {
    const r = computeCommission({ finalAgreedPrice: 1_910_000, grossCommissionPercent: 3, agentSharePercent: 50, agentSplitPercent: 80 });
    expect(r.grossCommission.toString()).toBe("28650");
    expect(r.brokerageCompanyCut.toString()).toBe("5730");
    expect(r.agentNetPayout.toString()).toBe("22920");
  });

  it("always makes house cut + net payout equal the gross, even with rounding", () => {
    const r = computeCommission({ finalAgreedPrice: "1234567.89", grossCommissionPercent: "2.5", agentSharePercent: "33.33", agentSplitPercent: 85 });
    expect(r.brokerageCompanyCut.add(r.agentNetPayout).eq(r.grossCommission)).toBe(true);
    expect(r.grossCommission.decimalPlaces()).toBeLessThanOrEqual(2);
  });
});

describe("sharesAddUpTo100", () => {
  it("accepts 100 and 50/50, rejects anything else", () => {
    expect(sharesAddUpTo100([100])).toBe(true);
    expect(sharesAddUpTo100(["50.00", "50.00"])).toBe(true);
    expect(sharesAddUpTo100([60, 50])).toBe(false);
  });
});

describe("date-based counters", () => {
  const now = new Date("2026-10-04T12:00:00Z");
  it("counts days on market until the listing went off market", () => {
    expect(daysOnMarket(new Date("2026-09-01T12:00:00Z"), new Date("2026-09-22T12:00:00Z"), now)).toBe(21);
    expect(daysOnMarket(new Date("2026-09-24T12:00:00Z"), null, now)).toBe(10);
    expect(daysOnMarket(null, null, now)).toBeNull();
  });
  it("starts escrow at day 1", () => {
    expect(escrowDay(now, now)).toBe(1);
    expect(escrowDay(new Date("2026-09-23T12:00:00Z"), now)).toBe(12);
  });
  it("finds the next open contingency and hours left", () => {
    const next = nextContingency(
      [
        { type: "LOAN", deadline: new Date("2026-10-14T12:00:00Z"), removedAt: null },
        { type: "INSPECTION", deadline: new Date("2026-10-06T12:00:00Z"), removedAt: null },
        { type: "APPRAISAL", deadline: new Date("2026-10-05T12:00:00Z"), removedAt: new Date() },
      ],
      now,
    );
    expect(next?.type).toBe("INSPECTION");
    expect(next?.hoursLeft).toBe(48);
    expect(next?.isOverdue).toBe(false);
  });
});

describe("onboardingProgress", () => {
  it("reports 5 of 6 steps as 83% with the awaiting step as current", () => {
    const steps = [
      { step: "W9_AND_BROKER_AGREEMENT", status: "COMPLETE" },
      { step: "STATE_DRE_LICENSE_TRANSFER", status: "AWAITING_EXTERNAL", blockerNote: "Awaiting State DRE approval" },
      { step: "MLS_BOARD_ACCESS", status: "COMPLETE" },
      { step: "SUPRA_EKEY", status: "COMPLETE" },
      { step: "CRM_PROVISIONING", status: "COMPLETE" },
      { step: "MENTOR_ASSIGNMENT", status: "COMPLETE" },
    ].map((s) => ({ blockerNote: null, ...s })) as Parameters<typeof onboardingProgress>[0];
    const p = onboardingProgress(steps);
    expect(p.percent).toBe(83);
    expect(p.currentStep).toBe("STATE_DRE_LICENSE_TRANSFER");
    expect(p.blockerNote).toBe("Awaiting State DRE approval");
  });
  it("treats missing step rows as not started", () => {
    expect(onboardingProgress([]).percent).toBe(0);
  });
});

describe("misc", () => {
  it("labels split tiers", () => expect(splitLabel("TIER_PRESTIGE_90_10")).toBe("90/10"));
  it("projects month volume from the daily run rate", () => {
    const p = monthPacing(3_000_000, new Date(2026, 8, 10));
    expect(p.daysInMonth).toBe(30);
    expect(p.daysRemaining).toBe(20);
    expect(p.projected).toBe(9_000_000);
  });
});
