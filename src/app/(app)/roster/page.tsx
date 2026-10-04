import { requireUser } from "@/lib/auth";
import { getRoster } from "@/lib/queries";
import { canSeeAgentFinancials, isStaff } from "@/lib/permissions";
import { splitLabel } from "@/lib/calc";
import { moneyCompact, titleCase } from "@/lib/format";
import { Badge, Card, PageHeader } from "@/components/ui";

export default async function RosterPage() {
  const user = await requireUser();
  const agents = await getRoster(user);
  const staff = isStaff(user.role);

  return (
    <>
      <PageHeader
        title="Agent roster"
        subtitle={staff ? "Ranked by gross commission income (GCI), year to date" : "Commission figures are visible only for your own profile"}
      />
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {staff && <th className="px-5 py-3 font-medium">#</th>}
              <th className="px-5 py-3 font-medium">Agent</th>
              <th className="px-5 py-3 font-medium">IDFPR license #</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Mentor</th>
              <th className="px-5 py-3 font-medium">Active listings</th>
              <th className="px-5 py-3 font-medium">Split</th>
              <th className="px-5 py-3 font-medium">GCI YTD</th>
              <th className="px-5 py-3 font-medium">Net YTD</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {agents.map((a, i) => {
              const visible = canSeeAgentFinancials(user, a.id);
              const isMe = a.id === user.agentId;
              return (
                <tr key={a.id} className={isMe ? "bg-amber-50/60" : undefined}>
                  {staff && <td className="px-5 py-3 font-semibold text-slate-500">{a.gciYtd ? i + 1 : "—"}</td>}
                  <td className="px-5 py-3">
                    <div className="font-medium">
                      {a.firstName} {a.lastName} {isMe && <span className="text-xs text-amber-700">(you)</span>}
                    </div>
                    <div className="text-xs text-slate-500">{a.title} · {a.email}</div>
                  </td>
                  <td className="px-5 py-3 tabular-nums">{a.licenseNumber}</td>
                  <td className="px-5 py-3">
                    <Badge tone={a.status === "ACTIVE" ? "green" : a.status === "ONBOARDING" ? "blue" : "slate"}>{titleCase(a.status)}</Badge>
                  </td>
                  <td className="px-5 py-3">{a.mentor ? `${a.mentor.firstName} ${a.mentor.lastName}` : "—"}</td>
                  <td className="px-5 py-3">{a._count.listings}</td>
                  <td className="px-5 py-3">{visible ? splitLabel(a.splitTier) : <Private />}</td>
                  <td className="px-5 py-3 font-medium">{visible ? (a.gciYtd != null ? moneyCompact(a.gciYtd) : "$0") : <Private />}</td>
                  <td className="px-5 py-3">{visible ? (a.netYtd != null ? moneyCompact(a.netYtd) : "$0") : <Private />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function Private() {
  return <span className="text-xs text-slate-400">Private</span>;
}
