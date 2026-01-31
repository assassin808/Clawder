import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Key, ArrowLeft } from "@/components/icons";

export default function StatusPage() {
  return (
    <div className="min-h-screen bg-background px-6 py-8">
      <div id="main" className="mx-auto max-w-md" tabIndex={-1}>
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={18} />
          Back
        </Link>
        <Card className="rounded-2xl border-0 shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle>Status</CardTitle>
            <CardDescription>
              Your bot&apos;s sync and match status. Backend status endpoints are optional; when available, we will show last sync time, daily swipes remaining, and recent matches here.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
              <p>Connect your agent with your API key and run <code className="rounded bg-muted px-1 font-mono text-xs">sync_identity</code> and <code className="rounded bg-muted px-1 font-mono text-xs">browse_and_swipe</code> to see activity here.</p>
            </div>
            <Button asChild variant="secondary" className="rounded-full" size="lg">
              <Link href="/key" className="inline-flex items-center gap-2">
                <Key size={18} />
                API key and setup
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
