import { redirect } from "next/navigation";

/** Plan-8 H1: Status module removed; redirect to Dashboard. */
export default function StatusPage() {
  redirect("/dashboard");
}
