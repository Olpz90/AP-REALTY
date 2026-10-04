import { requireUser } from "@/lib/auth";
import { getOnboarding } from "@/lib/queries";
import { updateOnboardingStepAction } from "@/lib/actions";
import { canEditOnboarding } from "@/lib/permissions";
import { ONBOARDING_STEPS, ONBOARDING_STEP_LABELS, onboardingProgress } from "@/lib/calc";
import { shortDate } from "@/lib/format";
import { STEP_STATUS } from "@/lib/labels";
import { Badge, Card, PageHeader, ProgressBar, SubmitButton } from "@/components/ui";

export default async function OnboardingPage() {
  const user = await requireUser();
  const records = await getOnboarding(user);
  const editable = canEditOnboarding(user.role);

  return (
    <>
      <PageHeader title="Agent onboarding tracker" subtitle={`${records.length} recruit${records.length === 1 ? "" : "s"} in progress`} />
      {records.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">No one is currently onboarding.</Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {records.map((r) => {
            const p = onboardingProgress(r.steps);
            const byStep = new Map(r.steps.map((s) => [s.step, s]));
            return (
              <Card key={r.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-lg font-semibold">
                      {r.agent.firstName} {r.agent.lastName}
                    </div>
                    <div className="text-xs text-slate-500">
                      Mentor: {r.agent.mentor ? `${r.agent.mentor.firstName} ${r.agent.mentor.lastName}` : "unassigned"} · Target{" "}
                      {shortDate(r.targetGraduationDate)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-semibold">{p.percent}%</div>
                    <div className="text-xs text-slate-500">
                      {p.completed} of {p.total} steps
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <ProgressBar percent={p.percent} label={`${r.agent.firstName} onboarding progress`} />
                </div>
                {p.currentStep && (
                  <p className="mt-3 text-sm">
                    <span className="text-slate-500">Now: </span>
                    <span className="font-medium">{ONBOARDING_STEP_LABELS[p.currentStep]}</span>
                    {p.blockerNote && <span className="text-amber-700"> — {p.blockerNote}</span>}
                  </p>
                )}
                <ol className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
                  {ONBOARDING_STEPS.map((step, i) => {
                    const row = byStep.get(step);
                    const status = row?.status ?? "NOT_STARTED";
                    return (
                      <li key={step} className="py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm">
                            <span className="mr-2 text-xs text-slate-400">{i + 1}</span>
                            {ONBOARDING_STEP_LABELS[step]}
                          </span>
                          <Badge tone={STEP_STATUS[status].tone}>{STEP_STATUS[status].label}</Badge>
                        </div>
                        {row?.blockerNote && <div className="mt-1 pl-5 text-xs text-slate-500">{row.blockerNote}</div>}
                        {editable && row && status !== "COMPLETE" && (
                          <form action={updateOnboardingStepAction} className="mt-2 flex flex-wrap items-center gap-2 pl-5">
                            <input type="hidden" name="stepId" value={row.id} />
                            <label className="sr-only" htmlFor={`status-${row.id}`}>Status</label>
                            <select id={`status-${row.id}`} name="status" defaultValue={status} className="rounded-md border border-slate-300 px-2 py-1 text-xs">
                              {Object.entries(STEP_STATUS).map(([value, s]) => (
                                <option key={value} value={value}>{s.label}</option>
                              ))}
                            </select>
                            <label className="sr-only" htmlFor={`note-${row.id}`}>Note</label>
                            <input id={`note-${row.id}`} name="blockerNote" defaultValue={row.blockerNote ?? ""} placeholder="Note (optional)" className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs" />
                            <SubmitButton tone="light">Save</SubmitButton>
                          </form>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
