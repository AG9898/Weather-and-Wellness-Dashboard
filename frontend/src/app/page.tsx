import { redirect } from "next/navigation";

/**
 * Root route — redirect to RA login.
 * The app has no public landing page; all flows start from /login.
 */
export default function RootPage() {
  redirect("/login");
}
