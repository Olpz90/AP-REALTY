import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getCompliance } from "@/lib/queries";
import { generateComplianceYearAction, updateComplianceItemAction } from "@/lib/actions";
import { canEditCompliance } from "@/lib/permissions";
import { BROKERAGE_NAME, complianceSummary, isIllinoisRenewalYear, isOverdue } from "@/lib/compliance";
import { shortDate } from "@/lib/format";
import { COMPLIANCE_STATUS, LICENSE_TYPE } from "@/lib/labels";
import { Badge, Card, PageHeader, ProgressBar, StatCard, SubmitButton } from "@/components/ui";

type Data = Awaited<ReturnType<typeof getCompliance>>;
type Item = Data["items"][number];

export default async function CompliancePage({ searchParams }: { searchParams: { year?: string } }) {
  const user = await requireUser();
  const now = new Date();
  const currentYear = now.getFullYear();
  const requested = Number(searchParams.year);
  const year = Number.isInteger(requested) && requested >= 2000 && requested <= currentYear + 1 ? requested : currentYear;
  const { items, years } = await getCompliance(user, year);
  const editable = canEditCompliance(user.role);

  const yearTabs = Array.from(new Set([...years, currentYear, year, ...(editable ? [currentYear + 1] : [])])).sort((a, b) => b - a);
  const summary = complianceSummary(items, now);
  const brokerageItems = items.filter((i) => !i.agentId);
  const byAgent = new Map<string, { agent: NonNullable<Item["agent"]>; items: Item[] }>();
  for (const i of items) {
    if (!i.agent) continue;
    const group = byAgent.get(i.agent.id) ?? { agent: i.agent, items: [] };
    group.items.push(i);
    byAgent.set(i.agent.id, group);
  }
  const licensees = Array.from(byAgent.values()).sort(
    (a, b) => Number(b.agent.licenseType === "MANAGING_BROKER") - Number(a.agent.licenseType === "MANAGING_BROKER") || a.agent.lastName.localeCompare(b.agent.lastName),
  );

  return (
    <>
      <PageHeader title="Illinois compliance" subtitle={`${BROKERAGE_NAME} · ${year} checklist${isIllinoisRenewalYear(year) ? " · license renewal year" : ""}`} />

      <div className="mb-6 flex flex-wrap gap-2">
        {yearTabs.map((y) => (
          <Link
            key={y}
            href={`/compliance?year=${y}`}
            aria-current={y === year ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset ${
              y === year ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {y}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">
          <p>No {year} checklist yet.</p>
          {editable && (
            <form action={generateComplianceYearAction} className="mt-4">
              <input type="hidden" name="year" value={year} />
              <SubmitButton>Create {year} checklist</SubmitButton>
            </form>
          )}
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label={`${year} complete`} value={`${summary.percent}%`} hint={`${summary.complete} of ${summary.total} items`} />
            <StatCard label="Overdue" value={String(summary.overdue)} hint={summary.overdue ? "Past due and not complete" : "Nothing past due"} />
            <StatCard
              label="License renewal"
              value={isIllinoisRenewalYear(year) ? "Due Apr 30" : "Not this year"}
              hint={isIllinoisRenewalYear(year) ? "CE and IDFPR renewal items included" : `Next renewal: ${year + 1}`}
            />
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Starter checklist based on the Illinois Real Estate License Act of 2000 (225 ILCS 454) and related Illinois law. Confirm items and dates with
            the managing broker or counsel.
            {editable && " New brokers are added to a year when you click “Add missing items”."}
          </p>
          {editable && (
            <form action={generateComplianceYearAction} className="mt-2">
              <input type="hidden" name="year" value={year} />
              <SubmitButton tone="light">Add missing items</SubmitButton>
            </form>
          )}

          <div className="mt-6 space-y-6">
            {brokerageItems.length > 0 && (
              <ChecklistCard title={`Brokerage: ${BROKERAGE_NAME}`} subtitle="Firm-level filings and reviews" items={brokerageItems} now={now} editable={editable} />
            )}
            {licensees.map(({ agent, items }) => (
              <ChecklistCard
                key={agent.id}
                title={`${agent.firstName} ${agent.lastName}`}
                subtitle={`${LICENSE_TYPE[agent.licenseType]} · IDFPR #${agent.licenseNumber}`}
                items={items}
                now={now}
                editable={editable}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function ChecklistCard({ title, subtitle, items, now, editable }: { title: string; subtitle: string; items: Item[]; now: Date; editable: boolean }) {
  const s = complianceSummary(items, now);
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <div className="flex w-56 items-center gap-3">
          <ProgressBar percent={s.percent} label={`${title} compliance progress`} />
          <span className="whitespace-nowrap text-xs text-slate-600">
            {s.complete}/{s.total}
          </span>
        </div>
      </div>
      <ul className="divide-y divide-slate-100">
        {items.map((item) => {
          const overdue = isOverdue(item, now);
          const st = COMPLIANCE_STATUS[item.status];
          return (
            <li key={item.id} className="px-5 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-900">{item.requirement.title}</div>
                  <div className="text-xs text-slate-500">{item.requirement.description}</div>
                  {item.requirement.reference && <div className="mt-0.5 text-[11px] text-slate-400">{item.requirement.reference}</div>}
                  {item.note && <div className="mt-1 text-xs text-amber-800">Note: {item.note}</div>}
                </div>
                <div className="flex flex-col items-end gap-1 text-xs">
                  <div className="flex gap-1.5">
                    {overdue && <Badge tone="red">Overdue</Badge>}
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                  <span className="text-slate-500">Due {shortDate(item.dueDate)}</span>
                  {item.completedAt && (
                    <span className="text-slate-400">
                      Done {shortDate(item.completedAt)}
                      {item.completedBy ? ` · ${item.completedBy.name}` : ""}
                    </span>
                  )}
                </div>
              </div>
              {editable && (
                <form action={updateComplianceItemAction} className="mt-2 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="itemId" value={item.id} />
                  <label className="sr-only" htmlFor={`status-${item.id}`}>Status</label>
                  <select id={`status-${item.id}`} name="status" defaultValue={item.status} className="rounded-md border border-slate-300 px-2 py-1 text-xs">
                    {Object.entries(COMPLIANCE_STATUS).map(([value, s]) => (
                      <option key={value} value={value}>{s.label}</option>
                    ))}
                  </select>
                  <label className="sr-only" htmlFor={`due-${item.id}`}>Due date</label>
                  <input id={`due-${item.id}`} type="date" name="dueDate" defaultValue={item.dueDate.toISOString().slice(0, 10)} className="rounded-md border border-slate-300 px-2 py-1 text-xs" />
                  <label className="sr-only" htmlFor={`note-${item.id}`}>Note</label>
                  <input id={`note-${item.id}`} name="note" defaultValue={item.note ?? ""} placeholder="Note (optional)" className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs" />
                  <SubmitButton tone="light">Save</SubmitButton>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
