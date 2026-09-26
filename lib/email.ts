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

/** Plain, short, and free of anything clinical. Mail is not a private channel. */
function layout(heading: string, lines: string[], code?: string) {
  const body = lines.map((l) => `<p style="margin:0 0 12px">${l}</p>`).join("");
  const codeBlock = code
    ? `<p style="margin:20px 0;font:600 20px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em">${code}</p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f6f7f9">
<div style="max-width:520px;margin:0 auto;padding:32px 24px;font:14px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:#1f2430">
<h1 style="margin:0 0 16px;font-size:18px">${heading}</h1>
${body}${codeBlock}
<p style="margin:24px 0 0;font-size:12px;color:#6b7280">
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
    `${options.invitedBy} has invited you to join <strong>${options.clinicName}</strong> on MediKonek as a ${role}.`,
    `Open <a href="${options.link}">${options.link}</a> and enter this code to set your password:`,
  ];

  return send({
    to: options.to,
    subject: `Join ${options.clinicName} on MediKonek`,
    text: [
      `${options.invitedBy} has invited you to join ${options.clinicName} on MediKonek as a ${role}.`,
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
    `<strong>${options.clinicName}</strong> has set up a MediKonek account for you, where you can see your appointments and ask for a booking.`,
    `Open <a href="${options.link}">${options.link}</a> and enter this code:`,
  ];

  return send({
    to: options.to,
    subject: `Activate your ${options.clinicName} account`,
    text: [
      `Hello ${options.patientName},`,
      ``,
      `${options.clinicName} has set up a MediKonek account for you, where you can`,
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
 * Where links in mail should point.
 *
 * Read from configuration rather than guessed from the request, because a
 * link in an email outlives the request that produced it.
 */
export function appUrl(path: string) {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}
