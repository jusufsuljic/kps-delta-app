import { redirect } from "next/navigation";

import { currentUser } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth-backend";

export const dynamic = "force-dynamic";

export default async function AuthCompletePage() {
  const user = await currentUser();

  if (!user) {
    redirect("/login?error=invalid");
  }

  if (user.mustChangePassword) {
    redirect("/change-password?mode=forced");
  }

  if (isAdminRole(user.role)) {
    redirect("/admin/dashboard");
  }

  redirect("/profile");
}
