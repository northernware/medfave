import type { Metadata } from "next";
import { requestAppointment } from "@/app/actions/requests";
import { requirePatientAccount } from "@/lib/auth";
import { clinicDoctorId } from "@/lib/clinic";
import { loadSchedule } from "@/lib/queries";
import { describeWeek, earliestBookableDay, latestBookableDay } from "@/lib/availability";
import { Card, PageHeader } from "@/components/ui";
import { RequestForm } from "./request-form";

export const metadata: Metadata = { title: "Request an appointment" };

export default async function RequestPage() {
  const me = await requirePatientAccount();

  // The clinic's own rules are shown to the patient rather than left for them
  // to discover by being refused.
  const doctorId = await clinicDoctorId(me.clinicId);
  const schedule = doctorId ? await loadSchedule(doctorId) : null;
  const now = new Date();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Request an appointment"
        subtitle={schedule ? describeWeek(schedule) : undefined}
      />

      <div className="rounded-lg border border-warn/40 bg-warn-tint px-4 py-3 text-[13px]">
        <p className="font-medium text-warn-ink">A request is not a booking.</p>
        <p className="mt-0.5 text-ink-muted">
          Nothing is held for you while the clinic reads it — the time you ask for can still be
          taken by somebody else. You will see the appointment here once staff confirm it.
        </p>
      </div>

      <Card className="p-5 sm:p-6">
        <RequestForm
          action={requestAppointment}
          earliest={schedule ? earliestBookableDay(schedule, now) : ""}
          latest={schedule ? latestBookableDay(schedule, now) : ""}
        />
      </Card>
    </div>
  );
}
