import { ResetPasswordForm } from "@/features/auth/reset-password-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ResetPasswordPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center p-6">
        <Card>
          <CardHeader>
            <CardTitle>Invalid reset link</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            The password reset token is missing.
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center p-6">
      <ResetPasswordForm token={token} />
    </main>
  );
}
