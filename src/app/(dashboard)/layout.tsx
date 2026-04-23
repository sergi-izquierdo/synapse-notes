import { CommandPalette } from "@/components/command-palette";
import { GlobalShortcuts } from "@/components/global-shortcuts";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Aquí anirà la Navbar o Sidebar més endavant */}
      <main className="flex-1">{children}</main>
      <CommandPalette />
      <GlobalShortcuts />
    </div>
  );
}
