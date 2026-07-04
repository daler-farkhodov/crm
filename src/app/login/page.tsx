import { DbSetupNotice } from "@/components/DbSetupNotice";
import { isLikelyDbConnectivityIssue } from "@/lib/is-prisma-db-error";
import { prisma } from "@/lib/prisma";
import { loginAsUser, logout } from "@/app/actions/auth";
import { LoginLanguageStrip } from "@/components/LoginLanguageStrip";
import { Card, PageTitle, Submit } from "@/components/ui";
import { getLocale } from "@/i18n/locale";
import { getMessages } from "@/i18n/messages";
import { t } from "@/i18n/t";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const locale = await getLocale();
  const m = getMessages(locale);
  let users: Awaited<ReturnType<typeof prisma.user.findMany>>;
  try {
    users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
    });
  } catch (e) {
    if (!isLikelyDbConnectivityIssue(e)) throw e;
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-16 dark:bg-slate-950">
        <div className="mx-auto max-w-md">
          <LoginLanguageStrip
            locale={locale}
            labels={{
              group: t(m, "language.group"),
              en: t(m, "language.en"),
              ru: t(m, "language.ru"),
              uz: t(m, "language.uz"),
            }}
          />
          <PageTitle title={t(m, "errors.pageTitle")} subtitle={t(m, "errors.genericBody")} />
          <DbSetupNotice
            title={t(m, "errors.dbTitle")}
            step1={t(m, "errors.dbStep1")}
            step2={t(m, "errors.dbStep2")}
            step3={t(m, "errors.dbStep3")}
            footnote={t(m, "errors.dbLocal")}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-16 dark:bg-slate-950">
      <div className="mx-auto max-w-md">
        <LoginLanguageStrip
          locale={locale}
          labels={{
            group: t(m, "language.group"),
            en: t(m, "language.en"),
            ru: t(m, "language.ru"),
            uz: t(m, "language.uz"),
          }}
        />
        <PageTitle title={t(m, "login.title")} subtitle={t(m, "login.subtitle")} />
        <Card>
          <form action={loginAsUser} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t(m, "login.user")}
              </label>
              <select
                name="userId"
                required
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({u.role}) — {u.email}
                  </option>
                ))}
              </select>
            </div>
            <Submit variant="blue">{t(m, "login.continue")}</Submit>
          </form>
          <form action={logout} className="mt-4">
            <button
              type="submit"
              className="text-sm text-slate-500 underline hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            >
              {t(m, "login.clearSession")}
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
