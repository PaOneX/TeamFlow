"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { login } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await login(formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Logged in successfully");
      router.push("/dashboard");
      router.refresh();
    });
  }

  async function onSocialSignIn(provider: "google" | "github") {
    await signIn(provider, { callbackUrl: "/dashboard" });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <div className="grid gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onSocialSignIn("google")}
          >
            Continue with Google
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onSocialSignIn("github")}
          >
            Continue with GitHub
          </Button>
        </div>

        <div className="text-sm text-muted-foreground">
          <Link href="/forgot-password" className="underline underline-offset-4">
            Forgot your password?
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
