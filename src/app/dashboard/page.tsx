import Link from "next/link";
import { requireAuth, getUserOrganizations } from "@/lib/session";
import { getDashboardMetrics } from "@/services/dashboard";
import { getProjectsByOrg } from "@/services/project";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateOrganizationForm } from "@/features/dashboard/create-organization-form";
import { CreateProjectForm } from "@/features/dashboard/create-project-form";

interface DashboardPageProps {
  searchParams: Promise<{ orgId?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await requireAuth();
  const memberships = await getUserOrganizations(session.user.id);

  if (memberships.length === 0) {
    return (
      <main className="mx-auto w-full max-w-4xl p-6 md:p-10">
        <CreateOrganizationForm />
      </main>
    );
  }

  const { orgId } = await searchParams;
  const activeMembership =
    memberships.find((membership) => membership.organizationId === orgId) ??
    memberships[0];
  const activeOrganization = activeMembership.organization;

  const [metrics, projects] = await Promise.all([
    getDashboardMetrics(activeOrganization.id),
    getProjectsByOrg(activeOrganization.id),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6 md:p-10">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">{activeOrganization.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {memberships.map((membership) => (
            <Button key={membership.organizationId} asChild variant="outline" size="sm">
              <Link href={`/dashboard?orgId=${membership.organizationId}`}>
                {membership.organization.name}
              </Link>
            </Button>
          ))}
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total projects</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {metrics.totalProjects}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total tasks</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {metrics.totalTasks}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Completed tasks</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {metrics.completedTasks}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Completion rate</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {metrics.completionRate}%
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Projects</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No projects yet. Create your first project.
              </p>
            ) : (
              projects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{project.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {project._count.tasks} tasks · {project._count.members} members
                    </p>
                  </div>
                  <Badge variant={project.status === "ACTIVE" ? "success" : "secondary"}>
                    {project.status}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>New project</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateProjectForm organizationId={activeOrganization.id} />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
