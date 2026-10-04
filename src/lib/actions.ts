"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "./db";
import { requireUser } from "./auth";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, signSessionToken } from "./session";
import {
  canApproveCommissions,
  canEditOnboarding,
  canManageEscrows,
  canMarkCommissionsPaid,
} from "./permissions";
import { cancelEscrow, closeEscrow } from "./escrow";

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
