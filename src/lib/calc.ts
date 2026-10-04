import { Prisma, type OnboardingStep, type SplitTier, type StepStatus } from "@prisma/client";

type Num = Prisma.Decimal | number | string;
const D = (v: Num) => new Prisma.Decimal(v);
const DAY_MS = 24 * 60 * 60 * 1000;

export const SPLIT_TIER_AGENT_PERCENT: Record<SplitTier, number> = {
  TIER_INCUBATOR_70_30: 70,
  TIER_ASSOCIATE_80_20: 80,
  TIER_STANDARD_85_15: 85,
  TIER_PRESTIGE_90_10: 90,
};

export function splitLabel(tier: SplitTier) {
  const agent = SPLIT_TIER_AGENT_PERCENT[tier];
  return `${agent}/${100 - agent}`;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  "W9_AND_BROKER_AGREEMENT",
  "IDFPR_SPONSORSHIP_TRANSFER",
  "MLS_BOARD_ACCESS",
  "SUPRA_EKEY",
  "CRM_PROVISIONING",
  "MENTOR_ASSIGNMENT",
];

export const ONBOARDING_STEP_LABELS: Record<OnboardingStep, string> = {
  W9_AND_BROKER_AGREEMENT: "W-9 & broker agreement",
  IDFPR_SPONSORSHIP_TRANSFER: "IDFPR license sponsorship transfer",
  MLS_BOARD_ACCESS: "MLS board access",
  SUPRA_EKEY: "Supra eKey",
  CRM_PROVISIONING: "CRM setup",
  MENTOR_ASSIGNMENT: "Mentor assignment",
};

/**
 * One agent's payout on a deal. The house cut is rounded and the net payout is
 * the remainder, so cut + payout always equals the gross exactly.
 */
export function computeCommission(input: {
  finalAgreedPrice: Num;
  grossCommissionPercent: Num;
  agentSharePercent: Num;
  agentSplitPercent: Num;
}) {
  const grossCommission = D(input.finalAgreedPrice)
    .mul(input.grossCommissionPercent)
    .div(100)
    .mul(input.agentSharePercent)
    .div(100)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const brokerageCompanyCut = grossCommission
    .mul(D(100).sub(input.agentSplitPercent))
    .div(100)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const agentNetPayout = grossCommission.sub(brokerageCompanyCut);
  return { grossCommission, brokerageCompanyCut, agentNetPayout };
}

export function sharesAddUpTo100(shares: Num[]) {
  return shares.reduce<Prisma.Decimal>((sum, s) => sum.add(s), D(0)).eq(100);
}

export function wholeDaysBetween(from: Date, to: Date) {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));
}

export function daysOnMarket(listedAt: Date | null, offMarketAt: Date | null, now: Date) {
  if (!listedAt) return null;
  return wholeDaysBetween(listedAt, offMarketAt ?? now);
}

export function escrowDay(escrowStartDate: Date, now: Date) {
  return wholeDaysBetween(escrowStartDate, now) + 1;
}

export function nextContingency<T extends { deadline: Date; removedAt: Date | null }>(
  contingencies: T[],
  now: Date,
) {
  const pending = contingencies
    .filter((c) => !c.removedAt)
    .sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
  const next = pending[0];
  if (!next) return null;
  const hoursLeft = Math.floor((next.deadline.getTime() - now.getTime()) / (60 * 60 * 1000));
  return { ...next, hoursLeft, isOverdue: hoursLeft < 0 };
}

export function onboardingProgress(
  steps: { step: OnboardingStep; status: StepStatus; blockerNote: string | null }[],
) {
  const byStep = new Map(steps.map((s) => [s.step, s]));
  const completed = ONBOARDING_STEPS.filter((s) => byStep.get(s)?.status === "COMPLETE").length;
  const current = ONBOARDING_STEPS.find((s) => byStep.get(s)?.status !== "COMPLETE") ?? null;
  const currentRow = current ? byStep.get(current) : undefined;
  return {
    completed,
    total: ONBOARDING_STEPS.length,
    percent: Math.round((completed / ONBOARDING_STEPS.length) * 100),
    currentStep: current,
    currentStatus: currentRow?.status ?? (current ? "NOT_STARTED" : null),
    blockerNote: currentRow?.blockerNote ?? null,
  };
}

export function monthPacing(closedMonthToDate: number, now: Date) {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysElapsed = now.getDate();
  return {
    daysInMonth,
    daysElapsed,
    daysRemaining: daysInMonth - daysElapsed,
    projected: (closedMonthToDate / daysElapsed) * daysInMonth,
  };
}
