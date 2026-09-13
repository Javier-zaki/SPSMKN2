import { RoleGuard } from "@/components/layout/RoleGuard";
import { AppShell } from "@/components/layout/AppShell";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGuard role="admin">
      <AppShell role="admin" title="Dashboard Admin">
        {children}
      </AppShell>
    </RoleGuard>
  );
}
