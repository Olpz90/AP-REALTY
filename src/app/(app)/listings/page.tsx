import Link from "next/link";
import type { ListingStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { getListings, LISTING_STATUSES } from "@/lib/queries";
import { cancelEscrowAction, closeEscrowAction } from "@/lib/actions";
import { canManageEscrows } from "@/lib/permissions";
import { daysOnMarket, escrowDay, nextContingency } from "@/lib/calc";
import { money, titleCase } from "@/lib/format";
import { LISTING_STATUS } from "@/lib/labels";
import { Badge, Card, PageHeader, SubmitButton } from "@/components/ui";

export default async function ListingsPage({ searchParams }: { searchParams: { status?: string } }) {
  const user = await requireUser();
  const status = LISTING_STATUSES.find((s) => s === searchParams.status) as ListingStatus | undefined;
  const listings = await getListings(user, status);
  const now = new Date();
  const tabs: { label: string; value?: ListingStatus }[] = [
    { label: "All current" },
    ...LISTING_STATUSES.map((s) => ({ label: LISTING_STATUS[s].label, value: s })),
  ];

  return (
    <>
      <PageHeader title="Listings & pipeline" subtitle={`${listings.length} properties`} />
      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((t) => {
          const active = t.value === status;
          return (
            <Link
              key={t.label}
              href={t.value ? `/listings?status=${t.value}` : "/listings"}
              aria-current={active ? "page" : undefined}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset ${
                active ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {listings.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">No listings with this status.</Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {listings.map((l) => {
            const dom = daysOnMarket(l.listedAt, l.offMarketAt, now);
            const deal = l.transactions[0];
            const next = deal ? nextContingency(deal.contingencies, now) : null;
            return (
              <Card key={l.id} className="flex flex-col overflow-hidden">
                <div className="relative">
                  {l.photos[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.photos[0].url} alt="" className="h-44 w-full object-cover" />
                  )}
                  <div className="absolute left-3 top-3">
                    <Badge tone={LISTING_STATUS[l.status].tone}>{LISTING_STATUS[l.status].label}</Badge>
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div>
                    <div className="text-lg font-semibold">{money(l.price)}</div>
                    <div className="text-sm text-slate-700">{l.address}</div>
                    <div className="text-xs text-slate-500">
                      {l.city}, {l.state} {l.zipCode} · MLS #{l.mlsNumber}
                    </div>
                  </div>
                  <div className="text-sm text-slate-600">
                    {l.bedrooms} bd · {Number(l.bathrooms)} ba · {l.squareFeet.toLocaleString()} sq ft
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>{dom != null ? `${dom} days on market` : "Not yet listed"}</span>
                    <span>{l.showingCount} showings</span>
                    <span>{l.offerCount} offers</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    Listing agent: <span className="font-medium text-slate-700">{l.primaryAgent.firstName} {l.primaryAgent.lastName}</span>
                  </div>
                  {deal && (
                    <div className="mt-auto space-y-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                      <div className="flex flex-wrap gap-2">
                        <span className="font-semibold">In escrow · Day {escrowDay(deal.escrowStartDate, now)}</span>
                        <span>{money(deal.finalAgreedPrice)} agreed</span>
                        {next && (
                          <span className={next.isOverdue ? "font-semibold text-rose-700" : ""}>
                            {titleCase(next.type)} {next.isOverdue ? "overdue" : `· ${next.hoursLeft}h left`}
                          </span>
                        )}
                      </div>
                      {canManageEscrows(user.role) && (
                        <div className="flex gap-2">
                          <form action={closeEscrowAction}>
                            <input type="hidden" name="transactionId" value={deal.id} />
                            <SubmitButton>Close escrow</SubmitButton>
                          </form>
                          <form action={cancelEscrowAction}>
                            <input type="hidden" name="transactionId" value={deal.id} />
                            <SubmitButton tone="danger">Cancel escrow</SubmitButton>
                          </form>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
