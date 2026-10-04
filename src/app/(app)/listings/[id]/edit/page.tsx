import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getListingAgentOptions, getListingForEdit } from "@/lib/queries";
import { canEditListing } from "@/lib/permissions";
import { isEscrowControlled } from "@/lib/listings";
import { Card, PageHeader } from "@/components/ui";
import { ListingForm } from "../../ListingForm";

export default async function EditListingPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const listing = await getListingForEdit(params.id);
  if (!listing || !canEditListing(user, listing)) notFound();
  const options = await getListingAgentOptions(user);
  const agents = options.map((a) => ({ id: a.id, name: `${a.firstName} ${a.lastName}` }));
  if (!agents.some((a) => a.id === listing.primaryAgentId)) {
    agents.push({ id: listing.primaryAgentId, name: "Current broker (inactive)" });
  }
  return (
    <>
      <PageHeader title="Edit listing" subtitle={`${listing.address}, ${listing.city}`} />
      <Card className="max-w-3xl p-6">
        <ListingForm
          agents={agents}
          statusLocked={isEscrowControlled(listing.status)}
          values={{
            id: listing.id,
            mlsNumber: listing.mlsNumber,
            address: listing.address,
            city: listing.city,
            state: listing.state,
            zipCode: listing.zipCode,
            price: listing.price.toString(),
            bedrooms: String(listing.bedrooms),
            bathrooms: listing.bathrooms.toString(),
            squareFeet: String(listing.squareFeet),
            status: listing.status,
            listedAt: listing.listedAt ? listing.listedAt.toISOString().slice(0, 10) : "",
            primaryAgentId: listing.primaryAgentId,
            photoUrl: listing.photos[0]?.url ?? "",
          }}
        />
      </Card>
    </>
  );
}
