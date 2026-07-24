import AppShell from "@/components/AppShell";

// Public entry — employees only. Admin/Player live at /admin and /player.
export default function Page() {
  return <AppShell view="employee" />;
}
