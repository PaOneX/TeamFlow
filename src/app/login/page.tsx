import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "@/features/auth/login-form";

export default async function LoginPage() {
  const session = await auth();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-4 p-6">
      <LoginForm />
      <p className="text-center text-sm text-muted-foreground">
        New to TeamFlow?{" "}
        <Link href="/register" className="underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </main>
  );
}
