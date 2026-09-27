import { auth } from "./auth";

export async function requireAdminForApi() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return new Response("Forbidden", { status: 403 });
  }
  return null;
}
