import { describe, expect, it } from "vitest";
import { listingDates, listingSchema } from "./listings";

const base = {
  mlsNumber: "MRED-12345",
  address: "123 Main St",
  city: "Chicago",
  zipCode: "60614",
  price: "$450,000",
  bedrooms: "3",
  bathrooms: "2.5",
  squareFeet: "1,850",
  primaryAgentId: "6f1c1a52-4d6b-4b8e-9a52-1d2f7e0b8c11",
};

describe("listingSchema", () => {
  it("accepts formatted numbers and defaults the state to IL", () => {
    const r = listingSchema.parse(base);
    expect(r).toMatchObject({ price: 450000, squareFeet: 1850, bathrooms: 2.5, state: "IL" });
  });

  it("rejects quarter baths, bad zips, missing prices and non-http photo links", () => {
    expect(listingSchema.safeParse({ ...base, bathrooms: "2.25" }).success).toBe(false);
    expect(listingSchema.safeParse({ ...base, zipCode: "6061" }).success).toBe(false);
    expect(listingSchema.safeParse({ ...base, price: "abc" }).success).toBe(false);
    expect(listingSchema.safeParse({ ...base, photoUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(listingSchema.safeParse({ ...base, photoUrl: "https://example.com/a.jpg" }).success).toBe(true);
  });

  it("does not allow escrow-controlled statuses from the form", () => {
    expect(listingSchema.safeParse({ ...base, status: "CLOSED" }).success).toBe(false);
    expect(listingSchema.safeParse({ ...base, status: "PENDING_ESCROW" }).success).toBe(false);
  });
});

describe("listingDates", () => {
  const now = new Date("2026-10-04T12:00:00Z");
  const earlier = new Date("2026-09-01T12:00:00Z");

  it("starts the days-on-market clock when a listing goes active", () => {
    expect(listingDates("ACTIVE", undefined, null, now)).toEqual({ listedAt: now, offMarketAt: null });
    expect(listingDates("COMING_SOON", undefined, null, now)).toEqual({ listedAt: null, offMarketAt: null });
  });

  it("keeps an existing list date and stops the clock on withdrawal", () => {
    const existing = { status: "ACTIVE" as const, listedAt: earlier, offMarketAt: null };
    expect(listingDates("WITHDRAWN", undefined, existing, now)).toEqual({ listedAt: earlier, offMarketAt: now });
    const withdrawn = { status: "WITHDRAWN" as const, listedAt: earlier, offMarketAt: now };
    expect(listingDates("WITHDRAWN", undefined, withdrawn, new Date("2026-11-01"))).toEqual({ listedAt: earlier, offMarketAt: now });
    expect(listingDates("ACTIVE", undefined, withdrawn, now)).toEqual({ listedAt: earlier, offMarketAt: null });
  });
});
