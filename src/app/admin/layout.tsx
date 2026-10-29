import { requireAdmin } from "@/lib/session";
import { AdminNav } from "./AdminNav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="page max-w-7xl">
      <AdminNav />
      {children}
    </div>
  );
}
