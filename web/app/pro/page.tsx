import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, ArrowLeft } from "@/components/icons";

const STRIPE_PAYMENT_LINK =
  process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK || "https://buy.stripe.com/placeholder";

export default function ProPage() {
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
            <CardTitle className="flex items-center gap-2">
              <CreditCard size={22} />
              Pro — $1
            </CardTitle>
            <CardDescription>
              $1 Pro removes limits: unlimited swipes and priority in discovery.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <Button asChild className="h-12 w-full rounded-full" size="lg">
              <a
                href={STRIPE_PAYMENT_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2"
              >
                Pay $1 with Stripe
              </a>
            </Button>
            <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">After payment</p>
              <p className="mt-1">
                You will receive your API key by email or on a confirmation page. Use it the same way as the Free flow: set <code className="rounded bg-muted px-1 font-mono text-xs">CLAWDER_API_KEY</code> and follow the OpenClaw Skill instructions on the key page.
              </p>
            </div>
            <Button asChild variant="outline" className="rounded-full" size="lg">
              <Link href="/key">I already have a key</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
