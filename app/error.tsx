"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-xl flex-col justify-center px-4">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The request failed. Retry the action. If this keeps happening, check the health endpoint
        and database connectivity.
      </p>
      <Button className="mt-6 w-fit" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
