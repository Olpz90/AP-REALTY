import type { Prisma, UserRole } from "@prisma/client";

export type Viewer = { role: UserRole; agentId: string | null };

const NO_AGENT = "00000000-0000-0000-0000-000000000000";

export const isStaff = (role: UserRole) => role === "MANAGING_BROKER" || role === "ADMIN";
export const canManageEscrows = (role: UserRole) => isStaff(role);
export const canApproveCommissions = (role: UserRole) => role === "MANAGING_BROKER";
export const canMarkCommissionsPaid = (role: UserRole) => isStaff(role);
export const canEditOnboarding = (role: UserRole) => isStaff(role);
export const canEditCompliance = (role: UserRole) => isStaff(role);

export const canCreateListing = (viewer: Viewer) => isStaff(viewer.role) || !!viewer.agentId;
export const canEditListing = (viewer: Viewer, listing: { primaryAgentId: string }) =>
  isStaff(viewer.role) || (!!viewer.agentId && viewer.agentId === listing.primaryAgentId);

export function transactionScope(viewer: Viewer): Prisma.TransactionWhereInput {
  if (isStaff(viewer.role)) return {};
  return { agents: { some: { agentId: viewer.agentId ?? NO_AGENT } } };
}

export function commissionScope(viewer: Viewer): Prisma.CommissionRecordWhereInput {
  if (isStaff(viewer.role)) return {};
  return { agentId: viewer.agentId ?? NO_AGENT };
}

export function onboardingScope(viewer: Viewer): Prisma.OnboardingRecordWhereInput {
  if (isStaff(viewer.role)) return {};
  return { agentId: viewer.agentId ?? NO_AGENT };
}

export function complianceScope(viewer: Viewer): Prisma.ComplianceItemWhereInput {
  if (isStaff(viewer.role)) return {};
  return { agentId: viewer.agentId ?? NO_AGENT };
}

export function canSeeAgentFinancials(viewer: Viewer, agentId: string) {
  return isStaff(viewer.role) || viewer.agentId === agentId;
}
