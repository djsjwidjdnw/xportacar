import { redirect } from "next/navigation";

// /admin has no screen of its own. Admins who type /admin (or come back from
// /login?next=/admin) go to the dashboard instead of a 404.
export default function AdminIndexPage() {
  redirect("/admin/dashboard");
}
