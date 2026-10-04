import { describe, expect, it } from "vitest";
import {
  canApproveCommissions,
  canManageEscrows,
  canSeeAgentFinancials,
  commissionScope,
  complianceScope,
  canEditCompliance,
  canCreateListing,
  canEditListing,
  transactionScope,
} from "./permissions";

describe("permissions", () => {
  const agent = { role: "AGENT" as const, agentId: "agent-1" };
  const broker = { role: "MANAGING_BROKER" as const, agentId: null };
  const admin = { role: "ADMIN" as const, agentId: null };

  it("limits agents to their own payouts and deals", () => {
    expect(commissionScope(agent)).toEqual({ agentId: "agent-1" });
    expect(transactionScope(agent)).toEqual({ agents: { some: { agentId: "agent-1" } } });
  });

  it("an agent account with no agent profile sees nothing", () => {
    const scope = commissionScope({ role: "AGENT", agentId: null }) as { agentId: string };
    expect(scope.agentId).not.toBe("agent-1");
    expect(scope.agentId).toBeTruthy();
  });

  it("gives staff the full view", () => {
    expect(commissionScope(broker)).toEqual({});
    expect(transactionScope(admin)).toEqual({});
  });

  it("only the managing broker approves payouts", () => {
    expect(canApproveCommissions("MANAGING_BROKER")).toBe(true);
    expect(canApproveCommissions("ADMIN")).toBe(false);
    expect(canApproveCommissions("AGENT")).toBe(false);
    expect(canManageEscrows("AGENT")).toBe(false);
  });

  it("agents can see only their own financials on the roster", () => {
    expect(canSeeAgentFinancials(agent, "agent-1")).toBe(true);
    expect(canSeeAgentFinancials(agent, "agent-2")).toBe(false);
    expect(canSeeAgentFinancials(admin, "agent-2")).toBe(true);
  });

  it("limits agents to their own compliance items; only staff edit them", () => {
    expect(complianceScope(agent)).toEqual({ agentId: "agent-1" });
    expect(complianceScope(admin)).toEqual({});
    expect(canEditCompliance("AGENT")).toBe(false);
    expect(canEditCompliance("MANAGING_BROKER")).toBe(true);
  });

  it("lets agents add and edit only their own listings", () => {
    expect(canCreateListing(agent)).toBe(true);
    expect(canEditListing(agent, { primaryAgentId: "agent-1" })).toBe(true);
    expect(canEditListing(agent, { primaryAgentId: "agent-2" })).toBe(false);
    expect(canEditListing(admin, { primaryAgentId: "agent-2" })).toBe(true);
    expect(canCreateListing({ role: "AGENT", agentId: null })).toBe(false);
  });
});
