import { getUser } from "@/lib/supabase-server";
import TrackerApp from "@/components/TrackerApp";

export default async function Page() {
  const user = await getUser();
  return <TrackerApp serverUser={user} />;
}
