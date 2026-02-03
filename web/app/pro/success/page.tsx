import { Suspense } from "react";
import ProSuccessClient from "./ProSuccessClient";

export default function ProSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background px-6 py-8">
          <div className="mx-auto max-w-md text-sm text-muted-foreground">Loading…</div>
        </div>
      }
    >
      <ProSuccessClient />
    </Suspense>
  );
}

