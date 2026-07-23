import Link from "next/link";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  "Organization and team management",
  "Projects, tasks, and kanban workflow",
  "Mentions, comments, and notifications",
  "Subscriptions and billing-ready architecture",
];

export default async function Home() {
  const session = await auth();
  const ctaHref = session ? "/dashboard" : "/login";
  const ctaLabel = session ? "Go to Dashboard" : "Get Started";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 p-6 md:p-10">
      <header className="space-y-4 pt-10">
        <p className="text-sm font-medium text-muted-foreground">TeamFlow</p>
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
          Manage projects, tasks, and teams in one workspace.
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Built with Next.js App Router, Server Actions, Prisma, and Auth.js.
        </p>

        <div className="flex gap-3">
          <Button asChild>
            <Link href={ctaHref}>{ctaLabel}</Link>
          </Button>
          {!session ? (
            <Button asChild variant="outline">
              <Link href="/register">Create Account</Link>
            </Button>
          ) : null}
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {features.map((feature) => (
          <Card key={feature}>
            <CardHeader>
              <CardTitle className="text-base">{feature}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Implemented with strict TypeScript, role-based membership checks,
              and server-first data flows.
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
