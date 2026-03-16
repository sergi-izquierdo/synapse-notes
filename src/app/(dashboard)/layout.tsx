import { CommandPalette } from "@/components/command-palette";

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
    </div>
  );
}
