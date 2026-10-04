import { requireUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions";
import { ROLE_LABELS } from "@/lib/labels";
import { Nav } from "@/components/Nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-screen">
      <header className="bg-slate-900">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6">
            <div className="text-base font-semibold tracking-tight text-white">
              A.P Realty <span className="text-amber-400">Group Inc.</span>
            </div>
            <Nav />
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-medium text-white">{user.name}</div>
              <div className="text-xs text-slate-400">{ROLE_LABELS[user.role]}</div>
            </div>
            <form action={logoutAction}>
              <button className="rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-300 ring-1 ring-inset ring-slate-600 hover:text-white">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
