import { getSession } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";
import { CalendarApp } from "@/components/CalendarApp";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getSession();

  if (!session) {
    return <LoginForm />;
  }

  return <CalendarApp session={session} />;
}
