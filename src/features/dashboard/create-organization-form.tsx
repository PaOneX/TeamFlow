"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { createOrganization } from "@/actions/organization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export function CreateOrganizationForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createOrganization(formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Organization created");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your first organization</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required minLength={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={3}
              placeholder="What does your team work on?"
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Creating..." : "Create organization"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
