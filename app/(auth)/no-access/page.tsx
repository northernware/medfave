import { redirect } from "next/navigation";

/** Replaced by /welcome, which gives an account with nothing linked yet something to do. Kept so old links still land. */
export default function NoAccessPage() {
  redirect("/welcome");
}
