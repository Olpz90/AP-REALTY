import "server-only";
import type { ListingStatus } from "@prisma/client";
import { prisma } from "./db";
import {
  commissionScope,
  complianceScope,
  isStaff,
  onboardingScope,
  transactionScope,
  type Viewer,
} from "./permissions";
import { daysOnMarket, monthPacing } from "./calc";

const num = (v: unknown) => (v == null ? 0 : Number(v));

export async function getDashboard(viewer: Viewer, now = new Date()) {
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const txScope = transactionScope(viewer);
  const staff = isStaff(viewer.role);

  const [closedYtd, closedMtd, open, gciYtd, monthTarget, annualGoal, listings, featured, upcoming] =
    await Promise.all([
      prisma.transaction.aggregate({
        where: { ...txScope, status: "CLOSED", actualClosingDate: { gte: yearStart } },
        _sum: { finalAgreedPrice: true },
        _count: true,
      }),
      prisma.transaction.aggregate({
        where: { ...txScope, status: "CLOSED", actualClosingDate: { gte: monthStart } },
        _sum: { finalAgreedPrice: true },
      }),
      prisma.transaction.aggregate({
        where: { ...txScope, status: "OPEN" },
        _sum: { finalAgreedPrice: true },
        _count: true,
      }),
      prisma.commissionRecord.aggregate({
        where: {
          ...commissionScope(viewer),
          transaction: { status: "CLOSED", actualClosingDate: { gte: yearStart } },
        },
        _sum: { grossCommission: true, agentNetPayout: true },
      }),
      prisma.brokerageMonthlyTarget.findUnique({
        where: { year_month: { year: now.getFullYear(), month: now.getMonth() + 1 } },
      }),
      prisma.brokerageAnnualGoal.findUnique({ where: { year: now.getFullYear() } }),
      prisma.listing.findMany({
        where: {
          listedAt: { not: null },
          OR: [{ offMarketAt: null }, { offMarketAt: { gte: yearStart } }],
        },
        select: { listedAt: true, offMarketAt: true },
      }),
      prisma.transaction.findFirst({
        where: { ...txScope, status: "OPEN" },
        orderBy: { finalAgreedPrice: "desc" },
        include: {
          listing: { include: { photos: { orderBy: { sortOrder: "asc" }, take: 1 } } },
          agents: { include: { agent: true } },
          contingencies: true,
        },
      }),
      prisma.transaction.findMany({
        where: { ...txScope, status: "OPEN" },
        orderBy: { targetClosingDate: "asc" },
        take: 6,
        include: { listing: true, agents: { include: { agent: true } }, contingencies: true },
      }),
    ]);

  const doms = listings
    .map((l) => daysOnMarket(l.listedAt, l.offMarketAt, now))
    .filter((d): d is number => d != null);
  const avgDom = doms.length ? Math.round(doms.reduce((a, b) => a + b, 0) / doms.length) : null;

  const [pendingApprovals, unpaid] = staff
    ? await Promise.all([
        prisma.commissionRecord.findMany({
          where: { approvedAt: null },
          include: { agent: true, transaction: { include: { listing: true } } },
          orderBy: { createdAt: "asc" },
        }),
        prisma.commissionRecord.findMany({
          where: { approvedAt: { not: null }, paidAt: null },
          include: { agent: true, transaction: { include: { listing: true } } },
          orderBy: { approvedAt: "asc" },
        }),
      ])
    : [[], []];

  return {
    scopeLabel: staff ? "Brokerage" : "Your",
    closedVolumeYtd: num(closedYtd._sum.finalAgreedPrice),
    closedCountYtd: closedYtd._count,
    underContractCount: open._count,
    underContractVolume: num(open._sum.finalAgreedPrice),
    gciYtd: num(gciYtd._sum.grossCommission),
    netPayoutYtd: num(gciYtd._sum.agentNetPayout),
    avgDom,
    mlsBenchmarkDom: monthTarget?.mlsBenchmarkDom ?? null,
    pacing: staff
      ? {
          monthTarget: num(monthTarget?.targetVolume),
          closedMtd: num(closedMtd._sum.finalAgreedPrice),
          annualGoal: num(annualGoal?.volumeGoal),
          ...monthPacing(num(closedMtd._sum.finalAgreedPrice), now),
        }
      : null,
    featured,
    upcoming,
    pendingApprovals,
    unpaid,
  };
}

export const LISTING_STATUSES: ListingStatus[] = [
  "COMING_SOON",
  "ACTIVE",
  "PENDING_ESCROW",
  "CLOSED",
  "WITHDRAWN",
];

export async function getListings(viewer: Viewer, status?: ListingStatus) {
  return prisma.listing.findMany({
    where: status ? { status } : { status: { not: "CLOSED" } },
    orderBy: [{ status: "asc" }, { price: "desc" }],
    include: {
      primaryAgent: true,
      photos: { orderBy: { sortOrder: "asc" }, take: 1 },
      transactions: {
        where: { ...transactionScope(viewer), status: "OPEN" },
        include: { contingencies: true, agents: { include: { agent: true } } },
      },
    },
  });
}

export async function getRoster(viewer: Viewer, now = new Date()) {
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const [agents, totals] = await Promise.all([
    prisma.agent.findMany({
      orderBy: [{ lastName: "asc" }],
      include: { mentor: true, _count: { select: { listings: { where: { status: "ACTIVE" } } } } },
    }),
    prisma.commissionRecord.groupBy({
      by: ["agentId"],
      where: {
        ...commissionScope(viewer),
        transaction: { status: "CLOSED", actualClosingDate: { gte: yearStart } },
      },
      _sum: { grossCommission: true, agentNetPayout: true },
      _count: true,
    }),
  ]);
  const byAgent = new Map(totals.map((t) => [t.agentId, t]));
  return agents
    .map((a) => {
      const t = byAgent.get(a.id);
      return {
        ...a,
        gciYtd: t ? num(t._sum.grossCommission) : null,
        netYtd: t ? num(t._sum.agentNetPayout) : null,
        dealsYtd: t?._count ?? null,
      };
    })
    .sort((a, b) => (b.gciYtd ?? -1) - (a.gciYtd ?? -1));
}

export async function getOnboarding(viewer: Viewer) {
  return prisma.onboardingRecord.findMany({
    where: { ...onboardingScope(viewer), graduatedAt: null },
    orderBy: { createdAt: "asc" },
    include: { agent: { include: { mentor: true } }, steps: true },
  });
}

export async function getCompliance(viewer: Viewer, year: number) {
  const scope = complianceScope(viewer);
  const [items, years] = await Promise.all([
    prisma.complianceItem.findMany({
      where: { ...scope, year },
      include: {
        requirement: true,
        agent: { select: { id: true, firstName: true, lastName: true, licenseType: true, licenseNumber: true } },
        completedBy: { select: { name: true } },
      },
      orderBy: [{ requirement: { sortOrder: "asc" } }],
    }),
    prisma.complianceItem.groupBy({ by: ["year"], where: scope, orderBy: { year: "desc" } }),
  ]);
  return { items, years: years.map((y) => y.year) };
}
