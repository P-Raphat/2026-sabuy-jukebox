import AppShell from "@/components/AppShell";

// Reachable only by URL. Still password-gated inside AdminView.
export default function AdminPage() {
  return <AppShell view="admin" />;
}
