import "server-only";
import { instantFromDb, instantToDb } from "@/lib/datetime";
import { findDoctor, shape } from "@/lib/discovery";
import { SERVICE_LABELS } from "@/lib/domain";
import { newId } from "@/lib/ids";
import type { CurrentPatient } from "@/lib/auth";
import { orm } from "@/src/prisma/db";

/*
 * Faves and after-visit feedback (medfave-design PRODUCT.md, decision 6).
 *
 * A fave is a login keeping a doctor close: private, never shown to the doctor
 * by name. Feedback is a patient's word on one finished visit, for the clinic
 * only. Neither is a public rating.
 */

/** How long after a visit the "How was it?" card is still offered. */
const ASK_FOR_DAYS = 14;

/** The doctors this login has faved, newest first, as Find a doctor shows them. */
export async function listFaves(accountId: string) {
  const faves = await orm.Fave
    .select("doctorId", "createdAt")
    .where((f) => f.accountId.eq(accountId))
    .orderBy((f) => f.createdAt.desc())
    .all();
  if (faves.length === 0) return [];
  const doctors = await orm.Doctor
    .select("id", "fullName", "specialty", "clinicId")
    .where((d) => d.id.in(faves.map((f) => f.doctorId)))
    .all();
  const shaped = await shape(doctors);
  return faves.flatMap((f) => shaped.filter((d) => d.id === f.doctorId));
}

export async function isFaved(accountId: string, doctorId: string) {
  return Boolean(
    await orm.Fave.select("id").where((f) => f.accountId.eq(accountId)).where((f) => f.doctorId.eq(doctorId)).first(),
  );
}

/** Faves or un-faves a verified doctor. Saying the same twice is fine. */
export async function setFave(accountId: string, doctorId: string, faved: boolean) {
  if (!faved) {
    await orm.Fave.where((f) => f.accountId.eq(accountId)).where((f) => f.doctorId.eq(doctorId)).delete();
    return { ok: true as const, faved };
  }
  if (!(await findDoctor(doctorId))) return { ok: false as const };
  if (!(await isFaved(accountId, doctorId))) {
    await orm.Fave.create({ id: newId(), accountId, doctorId, createdAt: instantToDb(new Date()) });
  }
  return { ok: true as const, faved };
}

/**
 * The visit to ask about: this person's latest completed visit in the last
 * two weeks that this login hasn't answered or closed the card for.
 */
export async function visitToAskAbout(me: CurrentPatient) {
  const since = instantToDb(new Date(Date.now() - ASK_FOR_DAYS * 86_400_000));
  const visit = await orm.Appointment
    .select("id", "scheduledAt", "service")
    .include("doctor", (d) => d.select("id", "fullName"))
    .where((a) => a.patientId.eq(me.patientId))
    .where((a) => a.status.eq("COMPLETED"))
    .where((a) => a.scheduledAt.gte(since))
    .orderBy((a) => a.scheduledAt.desc())
    .first();
  if (!visit) return null;
  const answered = await orm.VisitFeedback
    .select("id")
    .where((f) => f.appointmentId.eq(visit.id))
    .where((f) => f.accountId.eq(me.accountId))
    .first();
  if (answered) return null;
  return {
    id: visit.id,
    scheduledAt: instantFromDb(visit.scheduledAt).toISOString(),
    serviceLabel: SERVICE_LABELS[visit.service],
    doctor: { id: visit.doctor.id, fullName: visit.doctor.fullName },
    faved: await isFaved(me.accountId, visit.doctor.id),
  };
}

export type Rating = "GOOD" | "NOT_GREAT";

/** What can stand out about a visit: the tags on the rating sheet. The app has the words. */
export const FEEDBACK_TAGS = [
  "LISTENED",
  "EXPLAINED",
  "ON_TIME",
  "FRIENDLY",
  "CLEAN",
  "LONG_WAIT",
  "RUSHED",
  "UNCLEAR",
  "UNFRIENDLY",
  "COST",
] as const;
export type FeedbackTag = (typeof FEEDBACK_TAGS)[number];

/** The words the app shows for each tag, for the clinic's feedback page. Keep in step with the app. */
export const FEEDBACK_TAG_LABELS: Record<FeedbackTag, string> = {
  LISTENED: "Listened well",
  EXPLAINED: "Clear advice",
  ON_TIME: "On time",
  FRIENDLY: "Friendly",
  CLEAN: "Clean clinic",
  LONG_WAIT: "Long wait",
  RUSHED: "Felt rushed",
  UNCLEAR: "Unclear plan",
  UNFRIENDLY: "Unfriendly",
  COST: "Cost",
};

/** The words for each score, as the app's faces say them. */
export const SCORE_WORDS = ["", "Bad", "Not good", "Okay", "Good", "Great!"] as const;

export type Feedback = { score: number | null; rating: Rating | null; tags: FeedbackTag[]; note: string | null };

/**
 * Records what the patient said about a finished visit of theirs: a score from
 * the faces, what stood out and a line, or nothing (the sheet was closed).
 * Saying it again replaces it.
 */
export async function saveFeedback(me: CurrentPatient, appointmentId: string, feedback: Feedback) {
  const { score, tags, note } = feedback;
  // The coarse rating follows the score, for a clinic's at-a-glance count.
  const rating: Rating | null = score ? (score >= 4 ? "GOOD" : "NOT_GREAT") : feedback.rating;
  const fields = { rating, score, tags: tags.length ? tags.join(",") : null, note };
  const visit = await orm.Appointment
    .select("id", "status", "clinicId", "doctorId", "scheduledAt")
    .where((a) => a.id.eq(appointmentId))
    .where((a) => a.patientId.eq(me.patientId))
    .first();
  if (!visit) return { ok: false as const, status: 404, message: "No visit of yours with that id." };
  if (visit.status !== "COMPLETED") return { ok: false as const, status: 409, message: "Only a finished visit can be rated." };
  if (instantFromDb(visit.scheduledAt).getTime() < Date.now() - ASK_FOR_DAYS * 86_400_000) {
    return { ok: false as const, status: 409, message: "Visits can be rated for two weeks after." };
  }

  const existing = await orm.VisitFeedback
    .select("id")
    .where((f) => f.appointmentId.eq(visit.id))
    .where((f) => f.accountId.eq(me.accountId))
    .first();
  if (existing) {
    await orm.VisitFeedback.where((f) => f.id.eq(existing.id)).update(fields);
  } else {
    await orm.VisitFeedback.create({
      id: newId(),
      appointmentId: visit.id,
      accountId: me.accountId,
      clinicId: visit.clinicId,
      doctorId: visit.doctorId,
      ...fields,
      createdAt: instantToDb(new Date()),
    });
  }
  return { ok: true as const };
}
