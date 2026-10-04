import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="text-xl font-semibold tracking-tight">
            A.P Realty <span className="text-amber-500">Group Inc.</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">Sign in to the brokerage portal</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
