import { redirect } from "next/navigation";

import { isAdminAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

type AdminLoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  if (await isAdminAuthenticated()) {
    redirect("/admin/dashboard");
  }

  const params = await searchParams;
  const search = new URLSearchParams();
  search.set("mode", "admin");

  if (params.error) {
    search.set("error", params.error);
  }

  redirect(`/login?${search.toString()}`);
}
