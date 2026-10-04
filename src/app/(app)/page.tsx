import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getDashboard } from "@/lib/queries";
import { approveCommissionAction, markCommissionPaidAction } from "@/lib/actions";
import { canApproveCommissions, canMarkCommissionsPaid } from "@/lib/permissions";
import { escrowDay, nextContingency } from "@/lib/calc";
import { money, moneyCompact, shortDate, titleCase } from "@/lib/format";
import { Badge, Card, PageHeader, ProgressBar, StatCard, SubmitButton } from "@/components/ui";

export default async function DashboardPage() {
  const user = await requireUser();
  const now = new Date();
  const d = await getDashboard(user, now);
  const monthName = now.toLocaleDateString("en-US", { month: "long" });
  const featuredNext = d.featured ? nextContingency(d.featured.contingencies, now) : null;

  return (
    <>
      <PageHeader
        title={d.scopeLabel === "Brokerage" ? "Executive dashboard" : "My dashboard"}
        subtitle={`${now.getFullYear()} year to date · ${d.scopeLabel === "Brokerage" ? "all agents" : "deals you're on"}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={`${d.scopeLabel} closed volume`} value={moneyCompact(d.closedVolumeYtd)} hint={`${d.closedCountYtd} deals closed YTD`} />
        <StatCard label="Under contract" value={`${d.underContractCount} deals`} hint={`${moneyCompact(d.underContractVolume)} in escrow`} />
        <StatCard label="YTD GCI" value={moneyCompact(d.gciYtd)} hint={`${moneyCompact(d.netPayoutYtd)} agent net payouts`} />
        <StatCard
          label="Avg days on market"
          value={d.avgDom != null ? `${d.avgDom} days` : "—"}
          hint={d.mlsBenchmarkDom != null ? `vs ${d.mlsBenchmarkDom} days regional MLS` : undefined}
        />
      </div>

      {d.pacing && (
        <Card className="mt-6 p-5">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold text-slate-900">{monthName} pacing</h2>
                <span className="text-xs text-slate-500">{d.pacing.daysRemaining} days left</span>
              </div>
              <div className="mt-1 text-sm text-slate-600">
                {moneyCompact(d.pacing.closedMtd)} closed of {moneyCompact(d.pacing.monthTarget)} target · projected{" "}
                <span className="font-medium text-slate-900">{moneyCompact(d.pacing.projected)}</span>
              </div>
              <div className="mt-3">
                <ProgressBar
                  label={`${monthName} volume vs target`}
                  percent={d.pacing.monthTarget ? (d.pacing.closedMtd / d.pacing.monthTarget) * 100 : 0}
                  marker={d.pacing.monthTarget ? (d.pacing.projected / d.pacing.monthTarget) * 100 : undefined}
                />
              </div>
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Annual goal</h2>
                <span className="text-xs text-slate-500">{moneyCompact(d.pacing.annualGoal)}</span>
              </div>
              <div className="mt-1 text-sm text-slate-600">
                {moneyCompact(d.closedVolumeYtd)} closed ·{" "}
                {d.pacing.annualGoal ? Math.round((d.closedVolumeYtd / d.pacing.annualGoal) * 100) : 0}% of goal
              </div>
              <div className="mt-3">
                <ProgressBar label="Year to date volume vs annual goal" percent={d.pacing.annualGoal ? (d.closedVolumeYtd / d.pacing.annualGoal) * 100 : 0} />
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="overflow-hidden lg:col-span-2">
          <div className="border-b border-slate-100 px-5 py-3 text-sm font-semibold">Featured escrow</div>
          {d.featured ? (
            <div>
              {d.featured.listing.photos[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.featured.listing.photos[0].url} alt="" className="h-40 w-full object-cover" />
              )}
              <div className="space-y-3 p-5">
                <div>
                  <div className="text-xl font-semibold">{money(d.featured.finalAgreedPrice)}</div>
                  <div className="text-sm text-slate-600">
                    {d.featured.listing.address}, {d.featured.listing.city}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="amber">Day {escrowDay(d.featured.escrowStartDate, now)} of escrow</Badge>
                  {featuredNext && (
                    <Badge tone={featuredNext.isOverdue ? "red" : featuredNext.hoursLeft <= 72 ? "amber" : "slate"}>
                      {titleCase(featuredNext.type)}{" "}
                      {featuredNext.isOverdue ? "overdue" : `${featuredNext.hoursLeft}h left`}
                    </Badge>
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-slate-500">Agent(s)</dt>
                  <dd>{d.featured.agents.map((a) => `${a.agent.firstName} ${a.agent.lastName}`).join(", ")}</dd>
                  <dt className="text-slate-500">Target close</dt>
                  <dd>{shortDate(d.featured.targetClosingDate)}</dd>
                  <dt className="text-slate-500">Escrow</dt>
                  <dd>{d.featured.escrowCompany} · {d.featured.escrowNumber}</dd>
                </dl>
              </div>
            </div>
          ) : (
            <p className="p-5 text-sm text-slate-500">No open escrows.</p>
          )}
        </Card>

        <Card className="lg:col-span-3">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <span className="text-sm font-semibold">Upcoming closings</span>
            <Link href="/listings?status=PENDING_ESCROW" className="text-xs font-medium text-slate-500 hover:text-slate-900">
              View pipeline →
            </Link>
          </div>
          {d.upcoming.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">Nothing in escrow right now.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-2 font-medium">Property</th>
                    <th className="px-5 py-2 font-medium">Price</th>
                    <th className="px-5 py-2 font-medium">Escrow</th>
                    <th className="px-5 py-2 font-medium">Next deadline</th>
                    <th className="px-5 py-2 font-medium">Closes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {d.upcoming.map((t) => {
                    const next = nextContingency(t.contingencies, now);
                    return (
                      <tr key={t.id}>
                        <td className="px-5 py-3">
                          <div className="font-medium">{t.listing.address}</div>
                          <div className="text-xs text-slate-500">{t.agents.map((a) => a.agent.lastName).join(" / ")}</div>
                        </td>
                        <td className="px-5 py-3">{moneyCompact(t.finalAgreedPrice)}</td>
                        <td className="px-5 py-3">Day {escrowDay(t.escrowStartDate, now)}</td>
                        <td className="px-5 py-3">
                          {next ? (
                            <span className={next.isOverdue ? "text-rose-600" : next.hoursLeft <= 72 ? "text-amber-700" : ""}>
                              {titleCase(next.type)} · {next.isOverdue ? "overdue" : `${next.hoursLeft}h`}
                            </span>
                          ) : (
                            <span className="text-slate-400">Cleared</span>
                          )}
                        </td>
                        <td className="px-5 py-3">{shortDate(t.targetClosingDate)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {(d.pendingApprovals.length > 0 || d.unpaid.length > 0) && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <CommissionTable
            title="Commissions awaiting broker approval"
            rows={d.pendingApprovals}
            empty="Nothing to approve."
            action={canApproveCommissions(user.role) ? { fn: approveCommissionAction, label: "Approve" } : undefined}
          />
          <CommissionTable
            title="Approved, not yet paid"
            rows={d.unpaid}
            empty="All approved commissions are paid."
            action={canMarkCommissionsPaid(user.role) ? { fn: markCommissionPaidAction, label: "Mark paid" } : undefined}
          />
        </div>
      )}
    </>
  );
}

type CommissionRow = Awaited<ReturnType<typeof getDashboard>>["pendingApprovals"][number];

function CommissionTable({
  title,
  rows,
  empty,
  action,
}: {
  title: string;
  rows: CommissionRow[];
  empty: string;
  action?: { fn: (fd: FormData) => Promise<void>; label: string };
}) {
  return (
    <Card>
      <div className="border-b border-slate-100 px-5 py-3 text-sm font-semibold">{title}</div>
      {rows.length === 0 ? (
        <p className="p-5 text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
              <div>
                <div className="font-medium">
                  {r.agent.firstName} {r.agent.lastName} · {money(r.agentNetPayout)} net
                </div>
                <div className="text-xs text-slate-500">
                  {r.transaction.listing.address} · gross {money(r.grossCommission)} · {Number(r.agentSplitPercent)}/
                  {100 - Number(r.agentSplitPercent)} · house {money(r.brokerageCompanyCut)}
                </div>
              </div>
              {action && (
                <form action={action.fn}>
                  <input type="hidden" name="commissionId" value={r.id} />
                  <SubmitButton>{action.label}</SubmitButton>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
