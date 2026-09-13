import { RoleGuard } from "@/components/layout/RoleGuard";
import { AppShell } from "@/components/layout/AppShell";

export default function PetugasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGuard role="petugas">
      <AppShell role="petugas" title="Dashboard Petugas">
        {children}
      </AppShell>
    </RoleGuard>
  );
}
