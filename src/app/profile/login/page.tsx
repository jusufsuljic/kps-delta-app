import { redirect } from "next/navigation";

import { isShooterAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

type ProfileLoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function ProfileLoginPage({ searchParams }: ProfileLoginPageProps) {
  if (await isShooterAuthenticated()) {
    redirect("/profile");
  }

  const params = await searchParams;
  const search = new URLSearchParams();

  if (params.error) {
    search.set("error", params.error);
  }

  const query = search.toString();
  redirect(query ? `/login?${query}` : "/login");
}
