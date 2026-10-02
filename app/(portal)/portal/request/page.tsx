import type { Metadata } from "next";
import { requestAppointment } from "@/app/actions/requests";
import { requirePatientAccount } from "@/lib/auth";
import { lastDoctorFor, pickDoctor } from "@/lib/clinic";
import { loadSchedule } from "@/lib/queries";
import { describeWeek, earliestBookableDay, latestBookableDay } from "@/lib/availability";
import { DoctorPicker, withParam } from "@/components/doctor-picker";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { RequestForm } from "./request-form";

export const metadata: Metadata = { title: "Request an appointment" };

export default async function RequestPage({ searchParams }: PageProps<"/portal/request">) {
  const me = await requirePatientAccount();
  const params = await searchParams;

  // Patients ask for a doctor, not a clinic: the one they pick, else the one
  // they saw last, else the only one. Their hours are shown up front rather
  // than left to be discovered by a refusal.
  const { doctorId, doctors } = await pickDoctor(me.clinicId, params.doctor, await lastDoctorFor(me.clinicId, me.patientId));
  const schedule = doctorId ? await loadSchedule(doctorId) : null;
  const now = new Date();
  const whose = doctors.find((d) => d.id === doctorId);

  return (
    <div className="space-y-3">
      <PageHeader
        title="Request an appointment"
        subtitle={schedule ? `${whose && doctors.length > 1 ? `${whose.fullName}: ` : ""}${describeWeek(schedule)}` : undefined}
      />

      <div className="rounded-lg border border-warn/40 bg-warn-tint px-4 py-3 text-sm">
        <p className="font-medium text-warn-ink">A request is not a booking.</p>
        <p className="mt-0.5 text-ink-muted">
          Nothing is held for you while the clinic reads it — the time you ask for can still be
          taken by somebody else. You will see the appointment here once staff confirm it.
        </p>
      </div>

      {doctors.length === 0 ? (
        <Card>
          <EmptyState title="Not taking requests" description="This clinic isn't taking requests at the moment. Please call them." />
        </Card>
      ) : (
        <Card className="space-y-6 p-5 sm:p-6">
          <DoctorPicker
            label="Which doctor?"
            doctors={doctors}
            selected={doctorId}
            hrefFor={(id) => withParam("/portal/request", params, "doctor", id)}
          />
          {doctorId && schedule ? (
            <RequestForm
              action={requestAppointment}
              doctorId={doctorId}
              earliest={earliestBookableDay(schedule, now)}
              latest={latestBookableDay(schedule, now)}
            />
          ) : (
            <p className="text-sm text-ink-muted">Choose a doctor to see their hours.</p>
          )}
        </Card>
      )}
    </div>
  );
}
