import { RoleGuard } from "@/components/layout/RoleGuard";
import { AppShell } from "@/components/layout/AppShell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGuard role="siswa">
      <AppShell role="siswa" title="Dashboard Siswa">
        {children}
      </AppShell>
    </RoleGuard>
  );
}
