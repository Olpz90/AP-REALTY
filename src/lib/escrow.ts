import type { PrismaClient } from "@prisma/client";
import { SPLIT_TIER_AGENT_PERCENT, computeCommission, sharesAddUpTo100 } from "./calc";

export class EscrowError extends Error {}

/** Close an open escrow: mark it and its listing closed, and create one payout per agent. */
export async function closeEscrow(db: PrismaClient, transactionId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const deal = await tx.transaction.findUnique({
      where: { id: transactionId },
      include: { agents: { include: { agent: true } }, listing: true },
    });
    if (!deal) throw new EscrowError("Transaction not found");
    if (deal.status !== "OPEN") throw new EscrowError("Only open escrows can be closed");
    if (deal.agents.length === 0) throw new EscrowError("No agents are assigned to this deal");
    if (!sharesAddUpTo100(deal.agents.map((a) => a.splitPercent))) {
      throw new EscrowError("Agent shares on this deal must add up to 100%");
    }

    await tx.transaction.update({
      where: { id: deal.id },
      data: { status: "CLOSED", actualClosingDate: now },
    });
    await tx.listing.update({
      where: { id: deal.listingId },
      data: { status: "CLOSED", offMarketAt: deal.listing.offMarketAt ?? now },
    });

    const records = deal.agents.map((ta) => {
      const agentSplitPercent = SPLIT_TIER_AGENT_PERCENT[ta.agent.splitTier];
      return {
        transactionId: deal.id,
        agentId: ta.agentId,
        agentSplitPercent,
        ...computeCommission({
          finalAgreedPrice: deal.finalAgreedPrice,
          grossCommissionPercent: deal.grossCommissionPercent,
          agentSharePercent: ta.splitPercent,
          agentSplitPercent,
        }),
      };
    });
    await tx.commissionRecord.createMany({ data: records });
    return records;
  });
}

/** Cancel an open escrow (fall-through): keep the record, put the listing back on market. */
export async function cancelEscrow(db: PrismaClient, transactionId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const deal = await tx.transaction.findUnique({ where: { id: transactionId } });
    if (!deal) throw new EscrowError("Transaction not found");
    if (deal.status !== "OPEN") throw new EscrowError("Only open escrows can be cancelled");
    await tx.transaction.update({
      where: { id: deal.id },
      data: { status: "CANCELLED", cancelledAt: now },
    });
    await tx.listing.update({
      where: { id: deal.listingId },
      data: { status: "ACTIVE", offMarketAt: null },
    });
  });
}
