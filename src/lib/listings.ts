import { z } from "zod";
import type { ListingStatus } from "@prisma/client";

// PENDING_ESCROW and CLOSED are driven by the escrow workflow, not the listing form.
export const EDITABLE_LISTING_STATUSES = ["COMING_SOON", "ACTIVE", "WITHDRAWN"] as const;
export const isEscrowControlled = (s: ListingStatus) => s === "PENDING_ESCROW" || s === "CLOSED";

const toNumber = (v: unknown) => {
  if (typeof v !== "string") return v;
  const cleaned = v.replace(/[$,\s]/g, "");
  return cleaned === "" ? undefined : Number(cleaned);
};
const numberField = (msg: string) => z.number({ required_error: msg, invalid_type_error: msg });

export const listingSchema = z.object({
  id: z.string().uuid().optional(),
  mlsNumber: z.string().trim().min(1, "MLS # is required").max(30),
  address: z.string().trim().min(3, "Enter the street address").max(120),
  city: z.string().trim().min(2, "Enter the city").max(60),
  state: z.string().trim().toUpperCase().length(2, "Use the 2-letter state code").default("IL"),
  zipCode: z.string().trim().regex(/^\d{5}(-\d{4})?$/, "Enter a 5-digit zip code"),
  price: z.preprocess(toNumber, numberField("Enter a price, like 450000").positive().max(9_999_999_999)),
  bedrooms: z.preprocess(toNumber, numberField("Enter bedrooms").int().min(0).max(100)),
  bathrooms: z.preprocess(
    toNumber,
    numberField("Enter bathrooms").min(0).max(100).refine((n) => Number.isInteger(n * 2), "Use whole or half baths, like 2.5"),
  ),
  squareFeet: z.preprocess(toNumber, numberField("Enter square feet").int().positive().max(1_000_000)),
  status: z.enum(EDITABLE_LISTING_STATUSES).optional(),
  listedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  primaryAgentId: z.string({ required_error: "Choose a listing broker" }).uuid("Choose a listing broker"),
  photoUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v.startsWith("/") || /^https?:\/\//.test(v), "Photo link must start with https://")
    .optional(),
});

export type ListingInput = z.infer<typeof listingSchema>;

export const LISTING_FIELD_LABELS: Record<string, string> = {
  mlsNumber: "MLS #",
  address: "Address",
  city: "City",
  state: "State",
  zipCode: "Zip",
  price: "Price",
  bedrooms: "Bedrooms",
  bathrooms: "Bathrooms",
  squareFeet: "Square feet",
  status: "Status",
  listedAt: "List date",
  primaryAgentId: "Listing broker",
  photoUrl: "Photo link",
};

type ExistingDates = { status: ListingStatus; listedAt: Date | null; offMarketAt: Date | null } | null;

export function listingDates(next: ListingStatus, listedAtInput: Date | undefined, existing: ExistingDates, now: Date) {
  let listedAt = listedAtInput ?? existing?.listedAt ?? null;
  let offMarketAt = existing?.offMarketAt ?? null;
  if (next === "ACTIVE") {
    listedAt = listedAt ?? now;
    offMarketAt = null;
  } else if (next === "COMING_SOON") {
    offMarketAt = null;
  } else if (next === "WITHDRAWN" && existing?.status !== "WITHDRAWN") {
    offMarketAt = now;
  }
  return { listedAt, offMarketAt };
}
