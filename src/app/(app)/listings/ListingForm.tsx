"use client";

import Link from "next/link";
import type { ListingStatus } from "@prisma/client";
import { useFormState, useFormStatus } from "react-dom";
import { saveListingAction } from "@/lib/actions";
import { LISTING_STATUS } from "@/lib/labels";
import { EDITABLE_LISTING_STATUSES } from "@/lib/listings";

export type ListingFormValues = {
  id?: string;
  mlsNumber: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  price: string;
  bedrooms: string;
  bathrooms: string;
  squareFeet: string;
  status: ListingStatus;
  listedAt: string;
  primaryAgentId: string;
  photoUrl: string;
};

const inputClass =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:bg-slate-100 disabled:text-slate-500";

function Field({ label, name, hint, className = "", ...rest }: { label: string; name: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={className}>
      <label htmlFor={name} className="block text-sm font-medium text-slate-700">{label}</label>
      <input id={name} name={name} className={inputClass} {...rest} />
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Submit({ isNew }: { isNew: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 disabled:opacity-60">
      {pending ? "Saving…" : isNew ? "Add listing" : "Save changes"}
    </button>
  );
}

export function ListingForm({
  values,
  agents,
  statusLocked,
}: {
  values: ListingFormValues;
  agents: { id: string; name: string }[];
  statusLocked: boolean;
}) {
  const [state, formAction] = useFormState(saveListingAction, undefined);
  const isNew = !values.id;
  return (
    <form action={formAction} className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-6">
        {values.id && <input type="hidden" name="id" value={values.id} />}
        <Field label="Street address" name="address" defaultValue={values.address} required className="sm:col-span-6" placeholder="1420 N Lake Shore Dr" />
        <Field label="City" name="city" defaultValue={values.city} required className="sm:col-span-3" />
        <Field label="State" name="state" defaultValue={values.state} required maxLength={2} className="sm:col-span-1" />
        <Field label="Zip" name="zipCode" defaultValue={values.zipCode} required inputMode="numeric" className="sm:col-span-2" />
        <Field label="List price ($)" name="price" defaultValue={values.price} required inputMode="decimal" placeholder="450000" className="sm:col-span-2" />
        <Field label="MLS #" name="mlsNumber" defaultValue={values.mlsNumber} required className="sm:col-span-2" placeholder="MRED-12345678" />
        <Field label="List date" name="listedAt" type="date" defaultValue={values.listedAt} hint="Days on market count from here. Filled in automatically when the listing goes Active." className="sm:col-span-2" />
        <Field label="Bedrooms" name="bedrooms" type="number" min={0} defaultValue={values.bedrooms} required className="sm:col-span-2" />
        <Field label="Bathrooms" name="bathrooms" type="number" min={0} step={0.5} defaultValue={values.bathrooms} required className="sm:col-span-2" />
        <Field label="Square feet" name="squareFeet" type="number" min={1} defaultValue={values.squareFeet} required className="sm:col-span-2" />
      </section>

      <section className="grid gap-4 sm:grid-cols-6">
        <div className="sm:col-span-3">
          <label htmlFor="primaryAgentId" className="block text-sm font-medium text-slate-700">Listing broker</label>
          <select id="primaryAgentId" name="primaryAgentId" defaultValue={values.primaryAgentId} required className={inputClass}>
            {agents.length > 1 && <option value="">Choose…</option>}
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-3">
          <label htmlFor="status" className="block text-sm font-medium text-slate-700">Status</label>
          {statusLocked ? (
            <>
              <select id="status" disabled defaultValue={values.status} className={inputClass}>
                <option value={values.status}>{LISTING_STATUS[values.status].label}</option>
              </select>
              <p className="mt-1 text-xs text-slate-500">Set by the escrow. Close or cancel the escrow on the Listings page to change it.</p>
            </>
          ) : (
            <select id="status" name="status" defaultValue={values.status} className={inputClass}>
              {EDITABLE_LISTING_STATUSES.map((s) => (
                <option key={s} value={s}>{LISTING_STATUS[s].label}</option>
              ))}
            </select>
          )}
        </div>
        <Field
          label="Cover photo link"
          name="photoUrl"
          type="text"
          defaultValue={values.photoUrl}
          placeholder="https://…/photo.jpg"
          hint="Paste a link to the main photo (for example from the MLS). Leave blank for no photo."
          className="sm:col-span-6"
        />
      </section>

      {state?.error && <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>}
      <div className="flex items-center gap-3">
        <Submit isNew={isNew} />
        <Link href="/listings" className="text-sm font-medium text-slate-600 hover:text-slate-900">Cancel</Link>
      </div>
    </form>
  );
}
