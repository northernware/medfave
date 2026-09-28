import { apiDoctor, clinicBookingInfo } from "@/lib/api";

/** The doctor's clinic, and what the booking form needs. See `clinicBookingInfo`. */
export async function GET(request: Request) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  return Response.json(await clinicBookingInfo(doctor.clinicId));
}
