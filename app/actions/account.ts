"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { orm } from "@/src/prisma/db";
import { requireViewer } from "@/lib/auth";
import { instantToDb } from "@/lib/datetime";
import { createSession } from "@/lib/session";
import {
  accountDetailsSchema,
  clinicianProfileSchema,
  passwordChangeSchema,
  toFieldErrors,
  type FormState,
} from "@/lib/validation";

/** Matches the cost used everywhere else a password is hashed. */
const BCRYPT_COST = 12;

/**
 * A person's own name and sign-in address.
 *
 * Scoped to the viewer's own account and nothing else — the id never comes
 * from the form, so there is no id to tamper with. Every role shares this.
 */
export async function updateAccountDetails(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const viewer = await requireViewer();
  const parsed = accountDetailsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toFieldErrors(parsed.error);

  const { fullName, email } = parsed.data;

  if (email !== viewer.email) {
    const taken = await orm.Account
      .select("id")
      .where((a) => a.email.eq(email))
      .first();
    if (taken) {
      return {
        message: "That email is already in use.",
        fieldErrors: { email: ["Already registered to another account"] },
      };
    }
  }

  await orm.Account.where((a) => a.id.eq(viewer.accountId)).update({
    fullName,
    email,
    updatedAt: instantToDb(new Date()),
  });

  revalidatePath("/account");
  redirect("/account?saved=details");
}

/**
 * Changing a password, and ending every other session while doing it.
 *
 * The current password is verified first: an unlocked screen should not be
 * enough to take an account over. On success `sessionsValidFrom` moves to now,
 * which invalidates every token issued before this moment, and this browser is
 * handed a fresh one — so the person doing it stays signed in and everybody
 * holding an older copy does not.
 */
export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireViewer();
  const parsed = passwordChangeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toFieldErrors(parsed.error);

  const account = await orm.Account
    .select("id", "passwordHash")
    .where((a) => a.id.eq(viewer.accountId))
    .first();
  if (!account) redirect("/login");

  const matches = await bcrypt.compare(parsed.data.currentPassword, account.passwordHash);
  if (!matches) {
    return {
      message: "That is not your current password.",
      fieldErrors: { currentPassword: ["Incorrect"] },
    };
  }

  const now = new Date();
  await orm.Account.where((a) => a.id.eq(viewer.accountId)).update({
    passwordHash: await bcrypt.hash(parsed.data.password, BCRYPT_COST),
    sessionsValidFrom: instantToDb(now),
    updatedAt: instantToDb(now),
  });

  // Re-issued after the cut-off, so this browser survives its own change.
  await createSession(viewer.accountId);

  revalidatePath("/account");
  redirect("/account?saved=password");
}

/**
 * The clinician details that appear on paper.
 *
 * Specialty and licence number print on prescriptions and certificates, so
 * they belong to the person who signs them rather than to the practice.
 */
export async function updateClinicianProfile(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const viewer = await requireViewer();
  if (!viewer.doctorId) return { message: "This account has no clinician profile." };

  const parsed = clinicianProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toFieldErrors(parsed.error);

  await orm.Doctor.where((d) => d.id.eq(viewer.doctorId!)).update({
    ...parsed.data,
    // The name on a prescription is the account's name; keeping a second copy
    // in step is not worth the ways the two can disagree.
    fullName: viewer.fullName,
    updatedAt: instantToDb(new Date()),
  });

  revalidatePath("/account");
  redirect("/account?saved=clinician");
}
