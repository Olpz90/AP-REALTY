import type { ComplianceStatus, LicenseType, ListingStatus, StepStatus, UserRole } from "@prisma/client";
import type { Tone } from "@/components/ui";

export const ROLE_LABELS: Record<UserRole, string> = {
  MANAGING_BROKER: "Managing Broker",
  ADMIN: "Admin",
  AGENT: "Broker",
};

export const LISTING_STATUS: Record<ListingStatus, { label: string; tone: Tone }> = {
  COMING_SOON: { label: "Coming soon", tone: "blue" },
  ACTIVE: { label: "Active", tone: "green" },
  PENDING_ESCROW: { label: "Pending / Escrow", tone: "amber" },
  CLOSED: { label: "Closed", tone: "slate" },
  WITHDRAWN: { label: "Withdrawn", tone: "red" },
};

export const STEP_STATUS: Record<StepStatus, { label: string; tone: Tone }> = {
  NOT_STARTED: { label: "Not started", tone: "slate" },
  IN_PROGRESS: { label: "In progress", tone: "blue" },
  AWAITING_EXTERNAL: { label: "Awaiting external", tone: "amber" },
  BLOCKED: { label: "Blocked", tone: "red" },
  COMPLETE: { label: "Complete", tone: "green" },
};

export const LICENSE_TYPE: Record<LicenseType, string> = {
  MANAGING_BROKER: "Managing Broker",
  BROKER: "Broker",
};

export const COMPLIANCE_STATUS: Record<ComplianceStatus, { label: string; tone: Tone }> = {
  NOT_STARTED: { label: "Not started", tone: "slate" },
  IN_PROGRESS: { label: "In progress", tone: "blue" },
  COMPLETE: { label: "Complete", tone: "green" },
  NOT_APPLICABLE: { label: "N/A", tone: "slate" },
};
