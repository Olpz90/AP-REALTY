"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { requireUser } from "./auth";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, signSessionToken } from "./session";
import {
  canApproveCommissions,
  canCreateListing,
  canEditListing,
  canEditCompliance,
  canEditOnboarding,
  canManageEscrows,
  canMarkCommissionsPaid,
  isStaff,
} from "./permissions";
import { cancelEscrow, closeEscrow } from "./escrow";
import { ensureComplianceYear } from "./compliance";
import { isEscrowControlled, LISTING_FIELD_LABELS, listingDates, listingSchema } from "./listings";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export async function loginAction(_prev: { error?: string } | undefined, formData: FormData) {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  const invalid = { error: "Incorrect email or password." };
  if (!parsed.success) return invalid;
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  const ok =
    !!user?.passwordHash &&
    user.isActive &&
    (await bcrypt.compare(parsed.data.password, user.passwordHash));
  if (!user || !ok) return invalid;

  cookies().set(SESSION_COOKIE, await signSessionToken(user.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  redirect("/");
}

export async function logoutAction() {
  cookies().delete(SESSION_COOKIE);
  redirect("/login");
}

const idSchema = z.string().uuid();

export async function closeEscrowAction(formData: FormData) {
  const user = await requireUser();
  if (!canManageEscrows(user.role)) throw new Error("Not allowed");
  await closeEscrow(prisma, idSchema.parse(formData.get("transactionId")));
  revalidatePath("/", "layout");
}

export async function cancelEscrowAction(formData: FormData) {
  const user = await requireUser();
  if (!canManageEscrows(user.role)) throw new Error("Not allowed");
  await cancelEscrow(prisma, idSchema.parse(formData.get("transactionId")));
  revalidatePath("/", "layout");
}

export async function approveCommissionAction(formData: FormData) {
  const user = await requireUser();
  if (!canApproveCommissions(user.role)) throw new Error("Not allowed");
  await prisma.commissionRecord.updateMany({
    where: { id: idSchema.parse(formData.get("commissionId")), approvedAt: null },
    data: { approvedAt: new Date(), approvedById: user.id },
  });
  revalidatePath("/", "layout");
}

export async function markCommissionPaidAction(formData: FormData) {
  const user = await requireUser();
  if (!canMarkCommissionsPaid(user.role)) throw new Error("Not allowed");
  await prisma.commissionRecord.updateMany({
    where: {
      id: idSchema.parse(formData.get("commissionId")),
      approvedAt: { not: null },
      paidAt: null,
    },
    data: { paidAt: new Date() },
  });
  revalidatePath("/", "layout");
}

const stepSchema = z.object({
  stepId: z.string().uuid(),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "AWAITING_EXTERNAL", "BLOCKED", "COMPLETE"]),
  blockerNote: z.string().trim().max(200).optional(),
});

export async function updateOnboardingStepAction(formData: FormData) {
  const user = await requireUser();
  if (!canEditOnboarding(user.role)) throw new Error("Not allowed");
  const data = stepSchema.parse(Object.fromEntries(formData));
  await prisma.onboardingStepProgress.update({
    where: { id: data.stepId },
    data: {
      status: data.status,
      blockerNote: data.status === "COMPLETE" ? null : data.blockerNote || null,
      completedAt: data.status === "COMPLETE" ? new Date() : null,
    },
  });
  revalidatePath("/onboarding");
}

const complianceSchema = z.object({
  itemId: z.string().uuid(),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETE", "NOT_APPLICABLE"]),
  note: z.string().trim().max(300).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function updateComplianceItemAction(formData: FormData) {
  const user = await requireUser();
  if (!canEditCompliance(user.role)) throw new Error("Not allowed");
  const data = complianceSchema.parse(Object.fromEntries(formData));
  const item = await prisma.complianceItem.findUniqueOrThrow({ where: { id: data.itemId } });
  const complete = data.status === "COMPLETE";
  const alreadyComplete = item.status === "COMPLETE";
  await prisma.complianceItem.update({
    where: { id: item.id },
    data: {
      status: data.status,
      note: data.note || null,
      dueDate: data.dueDate ? new Date(`${data.dueDate}T12:00:00Z`) : undefined,
      completedAt: complete ? (alreadyComplete ? item.completedAt : new Date()) : null,
      completedById: complete ? (alreadyComplete ? item.completedById : user.id) : null,
    },
  });
  revalidatePath("/compliance");
}

export async function generateComplianceYearAction(formData: FormData) {
  const user = await requireUser();
  if (!canEditCompliance(user.role)) throw new Error("Not allowed");
  const maxYear = new Date().getFullYear() + 1;
  const year = z.coerce.number().int().min(2000).max(maxYear).parse(formData.get("year"));
  await ensureComplianceYear(prisma, year);
  revalidatePath("/compliance");
  redirect(`/compliance?year=${year}`);
}

export type ListingFormState = { error?: string } | undefined;

export async function saveListingAction(_prev: ListingFormState, formData: FormData): Promise<ListingFormState> {
  const user = await requireUser();
  const raw = Object.fromEntries(Array.from(formData.entries()).filter(([, v]) => v !== ""));
  const parsed = listingSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = String(issue.path[0] ?? "");
    return { error: `${LISTING_FIELD_LABELS[field] ?? "Form"}: ${issue.message}` };
  }
  const d = parsed.data;
  if (!canCreateListing(user) || (!isStaff(user.role) && d.primaryAgentId !== user.agentId)) {
    return { error: "You can only list properties for yourself." };
  }

  const existing = d.id
    ? await prisma.listing.findUnique({
        where: { id: d.id },
        include: { photos: { orderBy: { sortOrder: "asc" }, take: 1 } },
      })
    : null;
  if (d.id && (!existing || !canEditListing(user, existing))) return { error: "You can't edit this listing." };

  const status = existing && isEscrowControlled(existing.status) ? existing.status : (d.status ?? existing?.status ?? "COMING_SOON");
  const listedAtInput = d.listedAt ? new Date(`${d.listedAt}T12:00:00Z`) : undefined;
  const data = {
    mlsNumber: d.mlsNumber,
    address: d.address,
    city: d.city,
    state: d.state,
    zipCode: d.zipCode,
    price: d.price,
    bedrooms: d.bedrooms,
    bathrooms: d.bathrooms,
    squareFeet: d.squareFeet,
    primaryAgentId: d.primaryAgentId,
    status,
    ...listingDates(status, listedAtInput, existing, new Date()),
  };

  try {
    await prisma.$transaction(async (tx) => {
      const listing = existing
        ? await tx.listing.update({ where: { id: existing.id }, data })
        : await tx.listing.create({ data });
      const cover = existing?.photos[0];
      if (d.photoUrl && cover) {
        if (cover.url !== d.photoUrl) await tx.listingPhoto.update({ where: { id: cover.id }, data: { url: d.photoUrl } });
      } else if (d.photoUrl) {
        await tx.listingPhoto.create({ data: { listingId: listing.id, url: d.photoUrl, sortOrder: 0 } });
      } else if (cover) {
        await tx.listingPhoto.delete({ where: { id: cover.id } });
      }
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Another listing already uses that MLS #." };
    }
    throw e;
  }
  revalidatePath("/", "layout");
  redirect("/listings");
}
