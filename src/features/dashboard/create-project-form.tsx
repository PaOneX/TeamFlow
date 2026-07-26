"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { createProject } from "@/actions/project";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface CreateProjectFormProps {
  organizationId: string;
}

export function CreateProjectForm({ organizationId }: CreateProjectFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createProject(formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Project created");
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="space-y-3 rounded-lg border p-4">
      <input type="hidden" name="organizationId" value={organizationId} />
      <div className="space-y-2">
        <Label htmlFor="name">Project name</Label>
        <Input id="name" name="name" required minLength={2} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={2} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="dueDate">Due date</Label>
        <Input id="dueDate" name="dueDate" type="date" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating..." : "Create project"}
      </Button>
    </form>
  );
}
