import "server-only";
import { Resend } from "resend";

/**
 * Sending mail, when the clinic has configured somewhere to send it from.
 *
 * Every message here carries something the recipient needs in order to get
 * into the system, so the one rule that matters is this: **mail is never the
 * only copy**. The code is shown on screen to the person who issued it
 * whatever happens here, because an address can be mistyped, a provider can be
 * down, and a patient standing at the desk should not be sent home to wait for
 * an email that is not coming.
 *
 * That is why nothing in this file throws. A failure is reported back as a
 * result the caller can mention, not an exception that loses the code.
 */

export type SendOutcome =
  | { sent: true; id: string | null }
  | { sent: false; reason: "not-configured" | "failed"; detail?: string };

function config() {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return null;
  return { key, from };
}

/**
 * Writes the message to the log instead of sending it.
 *
 * For working on the wording without a Resend account, and without posting
 * test mail to somebody's real address. Set EMAIL_DRY_RUN=1.
 */
function dryRun() {
  return process.env.EMAIL_DRY_RUN === "1";
}

/** Whether the clinic has mail set up, for the UI to say so honestly. */
export function emailConfigured() {
  return config() !== null || dryRun();
}

let client: Resend | null = null;

async function send(message: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<SendOutcome> {
  if (dryRun()) {
    console.info(
      ["[email] dry run — not sent",
       `  to:      ${message.to}`,
       `  from:    ${process.env.EMAIL_FROM ?? "(unset)"}`,
       `  subject: ${message.subject}`,
       message.text.split("\n").map((l) => `  | ${l}`).join("\n"),
      ].join("\n"),
    );
    return { sent: true, id: null };
  }

  const settings = config();
  if (!settings) return { sent: false, reason: "not-configured" };

  try {
    client ??= new Resend(settings.key);
    const { data, error } = await client.emails.send({
      from: settings.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });

    if (error) {
      // Logged rather than thrown: the caller is in the middle of issuing a
      // credential and must not lose it because a mail server said no.
      console.error("[email] send failed:", error.message);
      return { sent: false, reason: "failed", detail: error.message };
    }
    return { sent: true, id: data?.id ?? null };
  } catch (cause) {
    console.error("[email] send threw:", cause);
    return { sent: false, reason: "failed", detail: String(cause) };
  }
}

// --- the messages themselves ------------------------------------------------

/**
 * Text going into an email's HTML. Names and addresses are whatever somebody
 * typed at sign-up, so they are escaped: a "name" of `<a href=…>` must arrive
 * as those characters, not as a link in a message that says it's from medfave.
 */
function esc(text: string) {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Plain, short, and free of anything clinical. Mail is not a private channel. */
function layout(heading: string, lines: string[], code?: string) {
  const body = lines.map((l) => `<p style="margin:0 0 12px">${l}</p>`).join("");
  const codeBlock = code
    ? `<p style="margin:20px 0;font:600 20px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em">${code}</p>`
    : "";
  // medfave palette: warm white canvas, plum text, fuchsia only as a small
  // accent rule — mail clients get no brand fonts, so system faces stand in.
  return `<!doctype html><html><body style="margin:0;background:#fff9fc">
<div style="max-width:520px;margin:0 auto;padding:32px 24px;font:15px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:#32132c">
<p style="margin:0 0 20px;font-weight:700;font-size:16px;color:#32132c"><span style="color:#e91e83">&#9829;</span> medfave</p>
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">${heading}</h1>
${body}${codeBlock}
<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #f0dce6;font-size:12px;color:#6b4f63">
If you were not expecting this, you can ignore it — nothing happens until the code is used.
</p>
</div></body></html>`;
}

/**
 * The invitation a doctor sends to somebody joining the clinic.
 *
 * Says who invited them and to what, because an unexplained code asking for a
 * password is indistinguishable from a phishing attempt.
 */
export async function sendStaffInvite(options: {
  to: string;
  clinicName: string;
  invitedBy: string;
  role: string;
  code: string;
  link: string;
}): Promise<SendOutcome> {
  const role = options.role.toLowerCase();
  const lines = [
    `${options.invitedBy} has invited you to join <strong>${options.clinicName}</strong> on medfave as a ${role}.`,
    `Open <a href="${options.link}">${options.link}</a> and enter this code to set your password:`,
  ];

  return send({
    to: options.to,
    subject: `Join ${options.clinicName} on medfave`,
    text: [
      `${options.invitedBy} has invited you to join ${options.clinicName} on medfave as a ${role}.`,
      ``,
      `Open ${options.link} and enter this code to set your password:`,
      ``,
      `    ${options.code}`,
      ``,
      `The invitation expires in seven days and can only be used once.`,
      `If you were not expecting this, you can ignore it.`,
    ].join("\n"),
    html: layout("You have been invited to a clinic", lines, options.code),
  });
}

/**
 * The code that connects a patient's login to their own records.
 *
 * Deliberately says nothing about the patient beyond their name — not their
 * condition, not their appointments. Mail passes through other people's
 * systems, and a clinical detail in a subject line is a disclosure.
 */
export async function sendPatientActivation(options: {
  to: string;
  patientName: string;
  clinicName: string;
  code: string;
  link: string;
}): Promise<SendOutcome> {
  const lines = [
    `Hello ${options.patientName},`,
    `<strong>${options.clinicName}</strong> has set up a medfave account for you, where you can see your appointments and ask for a booking.`,
    `Open <a href="${options.link}">${options.link}</a> and enter this code:`,
  ];

  return send({
    to: options.to,
    subject: `Activate your ${options.clinicName} account`,
    text: [
      `Hello ${options.patientName},`,
      ``,
      `${options.clinicName} has set up a medfave account for you, where you can`,
      `see your appointments and ask for a booking.`,
      ``,
      `Open ${options.link} and enter this code:`,
      ``,
      `    ${options.code}`,
      ``,
      `The code expires in fourteen days and can only be used once.`,
      `If you were not expecting this, you can ignore it.`,
    ].join("\n"),
    html: layout("Activate your clinic account", lines, options.code),
  });
}

/**
 * A link for somebody who cannot get in.
 *
 * Says which clinic and which address it is for, because a bare "reset your
 * password" is what a phishing message looks like. Says nothing else — a
 * reset email is sent to an address that may not be under the account
 * holder's control any more, which is exactly why it carries no clinical
 * content and no detail about who they are to the clinic.
 */
export async function sendPasswordReset(options: {
  to: string;
  name: string;
  link: string;
  code: string;
}): Promise<SendOutcome> {
  const lines = [
    `Hello ${esc(options.name)},`,
    `Somebody asked to reset the medfave password for <strong>${esc(options.to)}</strong>.`,
    `Open <a href="${esc(options.link)}">${esc(options.link)}</a>, or enter this code:`,
  ];

  return send({
    to: options.to,
    subject: "Reset your medfave password",
    text: [
      `Hello ${options.name},`,
      ``,
      `Somebody asked to reset the medfave password for ${options.to}.`,
      ``,
      `Open ${options.link}, or enter this code:`,
      ``,
      `    ${options.code}`,
      ``,
      `The link expires in one hour and can only be used once. Using it signs`,
      `out every device currently signed in as you.`,
      ``,
      `If this was not you, ignore it — your password has not changed.`,
    ].join("\n"),
    html: layout("Reset your password", lines, options.code),
  });
}

/** The link that proves somebody reads the inbox they signed up with. */
export async function sendEmailVerification(options: {
  to: string;
  name: string;
  link: string;
}): Promise<SendOutcome> {
  const lines = [
    `Hello ${esc(options.name)},`,
    `Welcome to medfave. Confirm that <strong>${esc(options.to)}</strong> is your email address:`,
    `<a href="${esc(options.link)}" style="display:inline-block;padding:10px 18px;border-radius:999px;background:#b51260;color:#ffffff;text-decoration:none;font-weight:600">Confirm my email</a>`,
    `Or open this link: <a href="${esc(options.link)}">${esc(options.link)}</a>`,
    `It works for three days.`,
  ];

  return send({
    to: options.to,
    subject: "Confirm your email for medfave",
    text: [
      `Hello ${options.name},`,
      ``,
      `Welcome to medfave. Confirm that ${options.to} is your email address by opening:`,
      ``,
      `    ${options.link}`,
      ``,
      `It works for three days. If you didn't sign up for medfave, ignore this email.`,
    ].join("\n"),
    html: layout("Confirm your email", lines),
  });
}

/**
 * Confirmation that a time has been booked.
 *
 * Says when, with whom, and where — and deliberately not what for. A service
 * name is a clinical fact ("Prenatal and Postnatal Consultation" tells anyone
 * who sees the screen a great deal), and mail sits in inboxes other people
 * read over shoulders. Whoever booked it already knows why.
 */
export async function sendAppointmentConfirmation(options: {
  to: string;
  patientName: string;
  clinicName: string;
  doctorName: string;
  when: string;
  link: string;
}): Promise<SendOutcome> {
  const lines = [
    `Hello ${options.patientName},`,
    `Your appointment at <strong>${options.clinicName}</strong> is booked for <strong>${options.when}</strong> with ${options.doctorName}.`,
    `If you cannot make it, please tell the clinic as early as you can so the time can go to somebody else.`,
  ];

  return send({
    to: options.to,
    subject: `Appointment booked — ${options.when}`,
    text: [
      `Hello ${options.patientName},`,
      ``,
      `Your appointment at ${options.clinicName} is booked for`,
      `${options.when} with ${options.doctorName}.`,
      ``,
      `If you cannot make it, please tell the clinic as early as you can so`,
      `the time can go to somebody else.`,
      ``,
      `See your appointments: ${options.link}`,
    ].join("\n"),
    html: layout("Your appointment is booked", lines),
  });
}

/**
 * The nudge the day before.
 *
 * Same restraint as the confirmation: a time, a clinician, a clinic. Sent once
 * — see `reminderSentAt` — because the second identical reminder is the one
 * that gets a sender marked as spam.
 */
export async function sendAppointmentReminder(options: {
  to: string;
  patientName: string;
  clinicName: string;
  doctorName: string;
  when: string;
  link: string;
}): Promise<SendOutcome> {
  const lines = [
    `Hello ${options.patientName},`,
    `A reminder that you have an appointment at <strong>${options.clinicName}</strong> tomorrow, <strong>${options.when}</strong>, with ${options.doctorName}.`,
    `If you can no longer come, please let the clinic know today.`,
  ];

  return send({
    to: options.to,
    subject: `Reminder: your appointment tomorrow, ${options.when}`,
    text: [
      `Hello ${options.patientName},`,
      ``,
      `A reminder that you have an appointment at ${options.clinicName}`,
      `tomorrow, ${options.when}, with ${options.doctorName}.`,
      ``,
      `If you can no longer come, please let the clinic know today.`,
      ``,
      `See your appointments: ${options.link}`,
    ].join("\n"),
    html: layout("Your appointment is tomorrow", lines),
  });
}

/**
 * Where links in mail should point.
 *
 * Read from configuration rather than guessed from the request, because a
 * link in an email outlives the request that produced it.
 */
export function appUrl(path: string) {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}
