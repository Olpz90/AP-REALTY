import type {
  ComplianceFrequency,
  ComplianceScope,
  ComplianceStatus,
  LicenseType,
  PrismaClient,
} from "@prisma/client";

export const BROKERAGE_NAME = "A.P Realty Group Inc.";

/** Illinois broker and managing broker licenses renew on April 30 of even-numbered years. */
export const isIllinoisRenewalYear = (year: number) => year % 2 === 0;

export type RequirementSeed = {
  code: string;
  title: string;
  description: string;
  reference?: string;
  scope: ComplianceScope;
  frequency: ComplianceFrequency;
  licenseTypes?: LicenseType[];
  dueMonth: number;
  dueDay: number;
};

const LICENSE_ACT = "Real Estate License Act of 2000 (225 ILCS 454)";

/**
 * Starter Illinois checklist. Confirm items and dates with the managing broker or counsel;
 * staff can adjust each year's due dates on the Compliance screen.
 */
export const ILLINOIS_REQUIREMENTS: RequirementSeed[] = [
  {
    code: "BROKERAGE_LICENSE_RENEWAL",
    title: "Renew the brokerage's real estate company license with IDFPR",
    description: "Confirm the expiration date on the IDFPR license lookup and renew before it lapses.",
    reference: LICENSE_ACT,
    scope: "BROKERAGE",
    frequency: "RENEWAL_YEAR",
    dueMonth: 4,
    dueDay: 30,
  },
  {
    code: "SOS_ANNUAL_REPORT",
    title: "File the Illinois Secretary of State annual report for the corporation",
    description: "Due before the first day of the corporation's anniversary month. Set this year's due date to match.",
    reference: "Business Corporation Act (805 ILCS 5)",
    scope: "BROKERAGE",
    frequency: "ANNUAL",
    dueMonth: 12,
    dueDay: 31,
  },
  {
    code: "MANAGING_BROKER_ON_FILE",
    title: "Confirm the designated managing broker on file with IDFPR is current",
    description: "The brokerage's IDFPR record should list the current designated managing broker.",
    reference: LICENSE_ACT,
    scope: "BROKERAGE",
    frequency: "ANNUAL",
    dueMonth: 1,
    dueDay: 31,
  },
  {
    code: "SPONSOR_ROSTER",
    title: "Reconcile sponsored licensees against the IDFPR license lookup",
    description: "Every broker working for the firm is actively sponsored. Departed licensees have been released.",
    reference: LICENSE_ACT,
    scope: "BROKERAGE",
    frequency: "ANNUAL",
    dueMonth: 1,
    dueDay: 31,
  },
  {
    code: "COMPANY_POLICIES",
    title: "Review written company policies and collect licensee acknowledgments",
    description: "Includes the brokerage-relationship (agency) policy. Each sponsored broker signs off on the current version.",
    reference: LICENSE_ACT,
    scope: "BROKERAGE",
    frequency: "ANNUAL",
    dueMonth: 1,
    dueDay: 31,
  },
  {
    code: "ADVERTISING_REVIEW",
    title: "Review advertising, websites and social media",
    description: "Ads show the brokerage name as registered with IDFPR. Licensee ads identify the sponsoring brokerage.",
    reference: LICENSE_ACT,
    scope: "BROKERAGE",
    frequency: "ANNUAL",
    dueMonth: 6,
    dueDay: 30,
  },
  {
    code: "ESCROW_RECONCILIATION",
    title: "Escrow (special) account: monthly reconciliations reviewed by the managing broker",
    description: "All 12 monthly reconciliations completed, signed and filed for the year.",
    reference: LICENSE_ACT,
    scope: "BROKERAGE",
    frequency: "ANNUAL",
    dueMonth: 12,
    dueDay: 31,
  },
  {
    code: "RECORDS_RETENTION",
    title: "Confirm transaction and escrow records are retained for at least 5 years",
    description: "Check record storage and the purge schedule.",
    reference: LICENSE_ACT,
    scope: "BROKERAGE",
    frequency: "ANNUAL",
    dueMonth: 12,
    dueDay: 31,
  },
  {
    code: "LICENSE_ACTIVE",
    title: "License active and sponsored by the brokerage on IDFPR lookup",
    description: "Save a copy of the lookup result.",
    reference: LICENSE_ACT,
    scope: "LICENSEE",
    frequency: "ANNUAL",
    dueMonth: 1,
    dueDay: 31,
  },
  {
    code: "LICENSE_RENEWAL",
    title: "Renew Illinois license with IDFPR",
    description: "Broker and managing broker licenses expire April 30 of even-numbered years.",
    reference: LICENSE_ACT,
    scope: "LICENSEE",
    frequency: "RENEWAL_YEAR",
    dueMonth: 4,
    dueDay: 30,
  },
  {
    code: "CE_BROKER",
    title: "Broker continuing education: 12 hours",
    description:
      "Includes the 4-hour core curriculum and 1-hour sexual harassment prevention course. On a broker's first renewal, the 45-hour post-license courses apply instead.",
    reference: LICENSE_ACT,
    scope: "LICENSEE",
    frequency: "RENEWAL_YEAR",
    licenseTypes: ["BROKER"],
    dueMonth: 4,
    dueDay: 30,
  },
  {
    code: "CE_MANAGING_BROKER",
    title: "Managing broker continuing education: 24 hours",
    description: "Includes the 12-hour broker management CE course plus the 12 hours of broker CE (core and sexual harassment prevention).",
    reference: LICENSE_ACT,
    scope: "LICENSEE",
    frequency: "RENEWAL_YEAR",
    licenseTypes: ["MANAGING_BROKER"],
    dueMonth: 4,
    dueDay: 30,
  },
  {
    code: "HARASSMENT_TRAINING",
    title: "Annual sexual harassment prevention training",
    description: "Required yearly for employees under the Illinois Human Rights Act. Keep the completion certificate on file.",
    reference: "Illinois Human Rights Act (775 ILCS 5/2-109)",
    scope: "LICENSEE",
    frequency: "ANNUAL",
    dueMonth: 12,
    dueDay: 31,
  },
  {
    code: "AGREEMENT_W9",
    title: "Signed independent contractor agreement and current W-9 on file",
    description: "Re-sign whenever the split or the agreement changes.",
    scope: "LICENSEE",
    frequency: "ANNUAL",
    dueMonth: 1,
    dueDay: 31,
  },
  {
    code: "MLS_DUES",
    title: "MLS and REALTOR® association dues paid",
    description: "Lapsed MLS access blocks listing and lockbox use.",
    scope: "LICENSEE",
    frequency: "ANNUAL",
    dueMonth: 1,
    dueDay: 31,
  },
];

export const appliesInYear = (frequency: ComplianceFrequency, year: number) =>
  frequency === "ANNUAL" || isIllinoisRenewalYear(year);

/** Noon UTC so the date shows the same day in every US time zone. */
export const complianceDueDate = (year: number, month: number, day: number) =>
  new Date(Date.UTC(year, month - 1, day, 12));

type Requirement = {
  id: string;
  scope: ComplianceScope;
  frequency: ComplianceFrequency;
  licenseTypes: LicenseType[];
  dueMonth: number;
  dueDay: number;
};

type ComplianceRow = { year: number; requirementId: string; agentId: string | null; dueDate: Date };

export function complianceItemsForYear(
  requirements: Requirement[],
  licensees: { id: string; licenseType: LicenseType }[],
  year: number,
): ComplianceRow[] {
  return requirements
    .filter((r) => appliesInYear(r.frequency, year))
    .flatMap((r): ComplianceRow[] => {
      const dueDate = complianceDueDate(year, r.dueMonth, r.dueDay);
      if (r.scope === "BROKERAGE") return [{ year, requirementId: r.id, agentId: null, dueDate }];
      return licensees
        .filter((a) => r.licenseTypes.length === 0 || r.licenseTypes.includes(a.licenseType))
        .map((a) => ({ year, requirementId: r.id, agentId: a.id, dueDate }));
    });
}

export function complianceSummary(items: { status: ComplianceStatus; dueDate: Date }[], now: Date) {
  const counted = items.filter((i) => i.status !== "NOT_APPLICABLE");
  const complete = counted.filter((i) => i.status === "COMPLETE").length;
  const overdue = counted.filter((i) => i.status !== "COMPLETE" && i.dueDate < now).length;
  return {
    total: counted.length,
    complete,
    overdue,
    percent: counted.length ? Math.round((complete / counted.length) * 100) : 0,
  };
}

export const isOverdue = (item: { status: ComplianceStatus; dueDate: Date }, now: Date) =>
  item.status !== "COMPLETE" && item.status !== "NOT_APPLICABLE" && item.dueDate < now;

export async function syncRequirementCatalog(db: PrismaClient) {
  for (const [sortOrder, r] of ILLINOIS_REQUIREMENTS.entries()) {
    const data = { ...r, licenseTypes: r.licenseTypes ?? [], reference: r.reference ?? null, sortOrder };
    await db.complianceRequirement.upsert({ where: { code: r.code }, create: data, update: data });
  }
}

/** Creates any missing checklist rows for the year. Safe to run repeatedly. */
export async function ensureComplianceYear(db: PrismaClient, year: number) {
  await syncRequirementCatalog(db);
  const [requirements, licensees] = await Promise.all([
    db.complianceRequirement.findMany({ where: { isActive: true } }),
    db.agent.findMany({
      where: { status: { in: ["ACTIVE", "ONBOARDING"] } },
      select: { id: true, licenseType: true },
    }),
  ]);
  const { count } = await db.complianceItem.createMany({
    data: complianceItemsForYear(requirements, licensees, year),
    skipDuplicates: true,
  });
  return count;
}
