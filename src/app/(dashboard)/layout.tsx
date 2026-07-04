import { AppShell } from "@/components/AppShell";
import { getLocale } from "@/i18n/locale";
import { getMessages } from "@/i18n/messages";
import { t } from "@/i18n/t";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const m = getMessages(locale);
  const nav = [
    { href: "/", label: t(m, "nav.dashboard") },
    { href: "/students", label: t(m, "nav.students") },
    { href: "/teachers", label: t(m, "nav.teachers") },
    { href: "/classes", label: t(m, "nav.classes") },
    { href: "/attendance", label: t(m, "nav.attendance") },
    { href: "/invoices", label: t(m, "nav.invoices") },
    { href: "/accounting", label: t(m, "nav.accounting") },
    { href: "/settings", label: t(m, "nav.settings") },
  ];
  const adminLinks = [
    { href: "/ledger", label: t(m, "admin.ledger") },
    { href: "/teacher-pay", label: t(m, "admin.teacherPay") },
    { href: "/expenses", label: t(m, "admin.expenses") },
    { href: "/closures", label: t(m, "admin.closures") },
    { href: "/users", label: t(m, "admin.users") },
    { href: "/audit", label: t(m, "admin.audit") },
  ];

  return (
    <AppShell locale={locale} messages={m} nav={nav} adminLinks={adminLinks}>
      {children}
    </AppShell>
  );
}
