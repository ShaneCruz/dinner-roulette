"use client";

import { Button, Card } from "@/components/ui";

/**
 * Shown when a page or a save fails. The most common cause is a new version
 * being deployed while a page was open, which a reload fixes.
 */
export function ErrorScreen({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <Card className="text-center">
        <div className="text-5xl" aria-hidden>
          🍝💥
        </div>
        <h1 className="mt-3 text-2xl font-bold">Well, that spilled.</h1>
        <p className="mt-2 text-muted">
          Something went wrong. If the app was just updated, a reload usually fixes it.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button type="button" onClick={() => window.location.reload()}>
            Reload
          </Button>
          <Button type="button" variant="secondary" onClick={retry}>
            Try again
          </Button>
        </div>
        {error.digest ? <p className="mt-4 text-xs text-muted">Error code {error.digest}</p> : null}
      </Card>
    </div>
  );
}
