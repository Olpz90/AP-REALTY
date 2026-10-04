import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getListingAgentOptions } from "@/lib/queries";
import { canCreateListing } from "@/lib/permissions";
import { Card, PageHeader } from "@/components/ui";
import { ListingForm } from "../ListingForm";

export default async function NewListingPage() {
  const user = await requireUser();
  if (!canCreateListing(user)) notFound();
  const agents = await getListingAgentOptions(user);
  return (
    <>
      <PageHeader title="Add listing" subtitle="New listings start as Coming soon unless you choose Active." />
      <Card className="max-w-3xl p-6">
        <ListingForm
          agents={agents.map((a) => ({ id: a.id, name: `${a.firstName} ${a.lastName}` }))}
          statusLocked={false}
          values={{
            mlsNumber: "",
            address: "",
            city: "",
            state: "IL",
            zipCode: "",
            price: "",
            bedrooms: "",
            bathrooms: "",
            squareFeet: "",
            status: "COMING_SOON",
            listedAt: "",
            primaryAgentId: agents.length === 1 ? agents[0].id : "",
            photoUrl: "",
          }}
        />
      </Card>
    </>
  );
}
